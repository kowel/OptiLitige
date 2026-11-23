// Pré-remplissage du traitement d'après les échanges (commentaires, déclaration, colonnes
// SharePoint). Les valeurs, chacune avec sa source, sont appliquées seulement aux champs vides :
// rien de ce qu'un agent a saisi n'est remplacé. Le dossier garde la liste des champs
// pré-remplis (« à vérifier ») jusqu'à ce que le Service Litige confirme.
import { CARRIER_DECISIONS } from './carrier-tracking.mjs';
import { imputations } from './followup.ts';

export const PREFILL_FIELDS = {
  carrierCaseRef: 'Référence de réclamation transporteur',
  carrierSentAt: 'Transmission au transporteur',
  carrierResponseDue: 'Réponse attendue le',
  carrierFollowupAt: 'Prochaine relance',
  carrierReplyAt: 'Réponse reçue le',
  carrierDecision: 'Décision du transporteur',
  carrierStatus: 'État du dossier transporteur',
  clientStage: 'Étape côté client',
  compensation: 'Indemnisation transporteur reçue',
  outcome: 'Résultat du litige',
  imputation: 'Imputation',
};
const DATES = ['carrierSentAt', 'carrierResponseDue', 'carrierFollowupAt', 'carrierReplyAt'];
// États « en attente » repris de SharePoint : une réponse connue peut les faire avancer
const WAITING = ['', 'À transmettre', 'Envoyé au transporteur', 'En attente réponse'];

const empty = (v) =>
  v === undefined || v === null || String(v).trim() === '' || /^non renseign/i.test(String(v));

/**
 * Applique les valeurs proposées à un dossier (modifié sur place).
 * @param {any} r
 * @param {Record<string, unknown>} fields
 * @param {Record<string, string>} sources
 * @param {{ now: string, author: string, carrierStages: string[], clientStages: string[], outcomes?: string[] }} ctx
 * @returns {{ applied: string[], skipped: { field: string, reason: string }[] }}
 */
export function applyPrefill(r, fields, sources, ctx) {
  const applied = [],
    skipped = [];
  for (const [field, raw] of Object.entries(fields || {})) {
    const skip = (reason) => skipped.push({ field, reason });
    if (!(field in PREFILL_FIELDS)) {
      skip('champ non prévu');
      continue;
    }
    let value = raw;
    if (DATES.includes(field)) {
      value = String(raw || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
        skip('date invalide');
        continue;
      }
    } else if (field === 'carrierDecision') {
      if (!CARRIER_DECISIONS.includes(raw)) {
        skip('décision inconnue');
        continue;
      }
    } else if (field === 'carrierStatus') {
      if (!ctx.carrierStages.includes(raw)) {
        skip('état inconnu');
        continue;
      }
    } else if (field === 'clientStage') {
      if (!ctx.clientStages.includes(raw)) {
        skip('étape inconnue');
        continue;
      }
    } else if (field === 'outcome') {
      if (!(ctx.outcomes || []).includes(raw)) {
        skip('résultat hors liste');
        continue;
      }
    } else if (field === 'imputation') {
      if (!imputations.includes(raw)) {
        skip('imputation inconnue');
        continue;
      }
    } else if (field === 'compensation') {
      value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        skip('montant invalide');
        continue;
      }
    } else
      value = String(raw || '')
        .trim()
        .slice(0, 200);
    const current = r[field];
    const free =
      field === 'carrierStatus'
        ? WAITING.includes(String(current || ''))
        : field === 'compensation'
          ? !Number(current)
          : empty(current);
    if (!free) {
      skip('déjà rempli');
      continue;
    }
    if (String(current ?? '') === String(value)) continue;
    r[field] = value;
    applied.push(field);
  }
  if (applied.length) {
    const before = r.prefilled?.fields || [];
    r.prefilled = {
      at: ctx.now,
      by: ctx.author,
      fields: [...new Set([...before, ...applied])],
      sources: {
        ...(r.prefilled?.sources || {}),
        ...Object.fromEntries(
          applied.filter((f) => sources?.[f]).map((f) => [f, String(sources[f]).slice(0, 500)]),
        ),
      },
    };
    r.history = [
      ...(r.history || []),
      {
        date: ctx.now,
        text:
          'Pré-rempli d’après les échanges (à vérifier) : ' +
          applied.map((f) => PREFILL_FIELDS[f]).join(', '),
        author: ctx.author,
      },
    ];
    r.rev = (r.rev || 0) + 1;
  }
  return { applied, skipped };
}
