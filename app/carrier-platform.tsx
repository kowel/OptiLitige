'use client';
import { useState } from 'react';
import { Check, ClipboardCopy, ExternalLink, Paperclip, Send, Truck } from 'lucide-react';
import { stakeOf } from './advanced-filters.mjs';
import { claimFormFor, claimSummary } from './claim-forms.mjs';
import type { ClaimForm, Dossier } from './types';

interface CarrierPlatformProps {
  record: Dossier;
  canEdit: boolean;
  /** Formulaires de réclamation (Paramètres → Transporteurs) */
  forms: Record<string, ClaimForm>;
}

const euros = (v: number) =>
  v ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v) : '';
const day = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) : '';

// Haut de l'onglet Transporteur d'un dossier : la future intégration du formulaire de
// réclamation de chaque transporteur. Le formulaire est déjà pré-rempli avec le dossier, tel
// qu'il partirait au service client du transporteur ; l'envoi direct attend une API de
// réclamation (aucun transporteur n'en propose aujourd'hui). En attendant : ouvrir le formulaire
// en ligne réglé dans Paramètres → Transporteurs et y coller le résumé. Les e-mails aux
// commerciaux restent en bas de l'onglet (app/transport-conversation.tsx).
export default function CarrierPlatform({ record: r, canEdit, forms }: CarrierPlatformProps) {
  const [copied, setCopied] = useState('');
  // Copie refusée par le navigateur : le texte s'affiche, sélectionné, dans une fenêtre de l'outil
  const [manual, setManual] = useState('');
  if (r.origin !== 'Transport') return null;
  const carrier = r.carrier || 'Transporteur non renseigné';
  const form = claimFormFor(forms, r.carrier);
  const files = r.attachments || [];
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2500);
    } catch {
      setManual(text);
    }
  };
  // Champs du formulaire de réclamation, remplis avec le dossier
  const fields: [string, string][] = [
    ['N° de compte client', form?.account || ''],
    ['N° de suivi', r.bt || ''],
    ['Référence Cybertek', r.ref],
    ['N° de commande', r.order || ''],
    ['Nature du litige', r.type || ''],
    ['Valeur déclarée', euros(Number(r.disputeValue) || stakeOf(r))],
    ['Date de déclaration', day(r.created)],
    ['Client', r.customer && !/^non renseign/i.test(r.customer) ? r.customer : ''],
  ];
  return (
    <section className="carrier-platform" aria-label={'Formulaire de réclamation ' + carrier}>
      {manual && (
        <div className="modal-overlay" onClick={() => setManual('')}>
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Copiez le texte"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Copiez le texte</h2>
            <div className="confirm-text">
              <p>La copie automatique est bloquée : le texte est sélectionné, faites Ctrl + C.</p>
              <textarea
                className="manual-copy"
                readOnly
                rows={8}
                value={manual}
                ref={(t) => t?.select()}
                onKeyDown={(e) => e.key === 'Escape' && setManual('')}
              />
            </div>
            <div className="confirm-actions">
              <button type="button" className="primary" onClick={() => setManual('')}>
                Fermer
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="carrier-platform-head">
        <span className="carrier-platform-icon">
          <Truck size={18} />
        </span>
        <div>
          <strong>Formulaire de réclamation {carrier}</strong>
          <small>Demande au service client du transporteur, pré-remplie avec ce dossier</small>
        </div>
        <span className="badge pending">Intégration à venir</span>
      </div>
      {form?.note && <p className="carrier-platform-note">{form.note}</p>}
      <dl className="carrier-form-fields">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={value ? '' : 'muted'}>{value || 'À compléter'}</dd>
          </div>
        ))}
        <div className="wide">
          <dt>Description</dt>
          <dd className={r.description ? 'carrier-form-desc' : 'muted'}>
            {String(r.description || '').trim() || 'À compléter'}
          </dd>
        </div>
        <div className="wide">
          <dt>Pièces jointes</dt>
          <dd className={files.length ? '' : 'muted'}>
            {files.length ? (
              <span className="carrier-form-files">
                {files.map((a) => (
                  <span key={a.id}>
                    <Paperclip size={12} /> {a.name}
                  </span>
                ))}
              </span>
            ) : (
              'Aucune pièce jointe'
            )}
          </dd>
        </div>
      </dl>
      {canEdit ? (
        <div className="carrier-platform-actions">
          <button
            type="button"
            className="primary"
            disabled
            title={'Pas encore d’API de réclamation chez ' + carrier}
          >
            <Send size={15} /> Envoyer à {carrier}
          </button>
          {form?.url && (
            <a className="secondary" href={form.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} /> Ouvrir le formulaire en ligne
            </a>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => copy('summary', claimSummary(r))}
          >
            {copied === 'summary' ? <Check size={15} /> : <ClipboardCopy size={15} />}
            {copied === 'summary' ? 'Résumé copié' : 'Copier le résumé'}
          </button>
        </div>
      ) : (
        <p className="muted">La réclamation au transporteur est faite par le Service Litige.</p>
      )}
      <small className="muted">
        L’envoi direct et le suivi de la réponse dans ce dossier arriveront si {carrier} ouvre une
        API de réclamation. En attendant, déposez la réclamation sur le formulaire en ligne (adresse
        et n° de compte dans Paramètres → Transporteurs), puis notez sa référence et la date de
        transmission dans le traitement.
      </small>
    </section>
  );
}
