// Analyse des relances au Service Litige (admins seulement) : un agent (RC, SAV…) tague le Service
// Litige pour demander des nouvelles d'un dossier (« @Lydia a-t-on des nouvelles ? »).
// - Commentaires repris de SharePoint : classés une fois pour toutes par une lecture du sens,
//   rangée dans le réglage RELANCES_KEY ({ cibles: [noms], items: { <id commentaire>: { c, client } } }).
// - Nouveaux commentaires : détection par règles (relanceKind), gratuite et sans service extérieur.

export const RELANCES_KEY = 'relances-historique';

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Tournures de demande de nouvelles (réglées sur 1 492 messages SharePoint classés par le sens) :
// suffisent à elles seules
const STRONG = [
  /\bdes (nouvelles|news?|infos?|informations)\b/,
  /\b(plus d'|d'autres? )(infos?|informations?|elements?)\b/,
  /\bdu nouveau\b|\b(pas|rien) de nouveau\b/,
  /\bdes nouveautes\b/,
  /\bou (en )?(est|sont|sommes|etes|es|on en est)\b/,
  /\bou (ca|cela) en est\b/,
  /\bqu'en est[- ]il\b/,
  /\b(ca|cela|le dossier) (a )?avance\b|\bavancer sur (le|ce) dossier\b/,
  /\bun (petit )?(retour|point|update|suivi)\b[^.]{0,40}(\?|svp|stp|s'il)/,
  /\b(petite |je (te|vous) |nouvelle )relance\b|\bje relance\b/,
  /\bje (me )?permets? de (te |vous )?relanc/,
  /\brelancer (le|ce) (dossier|litige)\b/,
  /\bje reviens (vers (toi|vous) )?aux nouvelles\b/,
  /\b(toujours|tjrs|tjs) (pas|rien|aucune?|en attente|sans)\b/,
  /\b(a ?t[- ]on|avons[- ]nous|as[- ]tu|tu as|vous avez|avez[- ]vous|on a|nous avions) (bien )?(eu|recu|obtenu|une reponse|un retour|la confirmation|la reponse|leur (retour|reponse))\b[^.]*\?/,
  /\b(as[- ]tu|tu as|avez[- ]vous|vous avez) (pu|reussi)\b[^.]*\?/,
  /\btu as vu mon message\b/,
  /\b(est[- ]ce que|est ce que) (la demande|l'avoir|le dossier|la reclamation|le remboursement|ma demande|notre demande)[^?]{0,60}(transmis|envoye|fait|cree|traite|valide|pris en compte|emis|parti)/,
  /\b(la demande|le dossier|l'avoir)[^?.]{0,30}(a[- ]t[- ]elle|a[- ]t[- ]il|a bien|est bien|est en cours)[^?]*\?/,
  /\b(je n'ai|nous n'avons|on n'a|n'est|ne sont) (toujours |a ce jour |encore )?(pas|aucun|aucune|rien)\b[^.]{0,30}(avoir|rembourse|retour|reponse|nouvelles?|disponible|recu)/,
  /\b(pas|aucun|aucune|sans) (eu )?(de )?(retour|reponse|nouvelles?)\b[^.]*\?/,
  /\bpas (encore )?(repondu|eu de retour)\b/,
  /\bun delai\b[^.]*\?/,
  /\b(il (nous|me) faudrait|nous avons besoin d|on a besoin d|j'ai besoin d)[^.?]{0,40}(retour|reponse|avoir|decision)/,
  /\b(le plus rapidement possible|au plus vite|rapidement svp|asap)\b/,
  /\b(ca|cela) (fait|va faire|commence a)\b[^.]{0,20}(\d+|un|une|deux|trois|quatre) ?(jours?|semaines?|mois)\b|\bcommence a (etre|faire) long\b/,
  /\b(on|nous) (arrive|arrivons|est|sommes) a \+? ?(\d+|un|deux|trois) (jours?|semaines?|mois)\b/,
  /\b(depuis|ouvert depuis|attend depuis) \+? ?(\d+|un|deux|trois) (semaines?|mois)\b|\battend depuis (longtemps|beaucoup)/,
  /\b(c'est|est-ce) (bon|fait|ok) (pour|de ton cote|de votre cote)[^?]*\?/,
];
// Mots qui, dans une courte question, demandent un état d'avancement
const WEAK =
  /\b(retour|reponse|confirmation|nouvelles?|avancement|statut|etat|indemnisation|l'avoir|news?)\b/;
// Demande d'action ou question nouvelle (« possible de faire un avoir ? ») : pas une relance
const REQUEST =
  /\b(possible|peux|pourrais|pourrait|peut|pouvons|pourrions|pourriez|faut[- ]il|faudrait[- ]il|doit[- ]on|dois[- ]je|on fait|pourquoi|comment|quel|quelle|est[- ]ce qu'on (peut|pourrait|doit))\b/;
const COURTESY =
  /^(merci|ok|d'accord|entendu|parfait|top|super|bonjour|hello|c'est note)\b[\s!.,:)a-z]{0,20}$/;

// Le client s'impatiente : il relance, appelle, menace…
const CLIENT =
  /\bclient(e)?\b[^.?!]{0,40}\b(relance|rappelle|appelle|recontacte|s'impatiente|s'enerve|insiste|est insistant|exige|menace|harcele|attend toujours|revient (vers nous|regulierement|une nouvelle fois)|est (encore )?revenu|est (tres )?(mecontent|enerve|impatient))|\btous les jours\b|\b(met|mis) en demeure\b|\bmise en demeure\b|\bdgccrf\b|\bsignal ?conso\b|\blettre recommandee?\b|\bmenace de poursuites?\b/;

const PRESSING =
  /\b(relance|rappelle|recontacte|s'impatiente|harcele|tous les jours|revient vers nous|attend toujours)\b/;

/** « relance » si le texte demande des nouvelles, sinon « autre » ; client = le client s'impatiente.
 * names : noms tagués à retirer du texte (« @Lydia CARTIER »), pour ne garder que la phrase. */
export function relanceKind(text, names = []) {
  let raw = String(text ?? '');
  for (const n of names) if (n) raw = raw.split('@' + n).join(' ');
  raw = raw.replace(/@[\p{L}'-]+(?: [\p{Lu}][\p{Lu}'-]+)?/gu, ' ');
  const t = norm(raw);
  const client = CLIENT.test(t);
  // Tag seul suivi d'un « ? » : « @Lydia ? »
  if (/^[?!.\s]+$/.test(t) && t.includes('?')) return { c: 'relance', client };
  if (!t || COURTESY.test(t)) return { c: 'autre', client };
  if (STRONG.some((re) => re.test(t))) return { c: 'relance', client };
  // « Le client nous relance… » : pression transmise au Service Litige
  if (client && PRESSING.test(t) && !REQUEST.test(t)) return { c: 'relance', client };
  // Question courte sur un point en attente (« un retour ? », « la confirmation ? »)
  if (/\?/.test(t) && WEAK.test(t) && t.length <= 160 && !REQUEST.test(t))
    return { c: 'relance', client };
  return { c: 'autre', client };
}

const strip = (name) => String(name || '').replace(/\s*\(SharePoint\)\s*$/i, '');
const key = (name) => norm(strip(name));

/**
 * Tags du Service Litige trouvés dans les dossiers.
 * records : dossiers complets (commentaires) ; members : comptes ; history : réglage RELANCES_KEY.
 * Renvoie une ligne par commentaire qui tague (ou nomme, pour l'historique) le Service Litige.
 */
/** Service affiché pour un auteur sans compte (ancien agent RC / SAV repris de SharePoint) */
import { impatientAt } from './impatience.mjs';

export const SANS_COMPTE = 'RC / SAV (sans compte)';

export function relanceRows(records, members, history = {}) {
  const items = history.items || {};
  const byEmail = new Map(members.map((m) => [String(m.email).toLowerCase(), m]));
  const byName = new Map(members.map((m) => [key(m.name), m]));
  const litige = members.filter((m) => m.role === 'Service Litige');
  // Personnes du Service Litige : comptes actuels + noms de l'historique (ex. « Lydia CARTIER »)
  const targetNames = [
    ...new Set([...litige.map((m) => strip(m.name)), ...(history.cibles || [])]),
  ];
  const targetKeys = new Set(targetNames.map(key));
  const isTarget = (c) =>
    targetKeys.has(key(c.author)) || litige.some((m) => m.email && m.email === c.email);
  const rows = [];
  for (const r of records) {
    const cs = [...(r.comments || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    cs.forEach((c, i) => {
      if (isTarget(c)) return;
      const text = String(c.text || '');
      const tagged = (c.mentions || [])
        .map((e) => byEmail.get(String(e).toLowerCase()))
        .filter((m) => m && m.role === 'Service Litige')
        .map((m) => strip(m.name));
      const named = targetNames.filter((n) => norm(text).includes('@' + norm(n)));
      const target = [...new Set([...tagged, ...named])];
      const known = items[c.id];
      if (!target.length && !known) return;
      // Relance = un agent RC ou SAV qui demande au Service Litige où en est le dossier. Les
      // messages des Responsables, Admins (ou d'un compte désactivé) ne comptent pas ; un auteur
      // sans compte est un ancien agent RC / SAV repris de SharePoint.
      const author = byEmail.get(String(c.email || '').toLowerCase()) || byName.get(key(c.author));
      if (author && !['RC', 'SAV'].includes(author.role)) return;
      const k = known ? { c: known.c, client: !!known.client } : relanceKind(text, targetNames);
      // Repère « client qui s'impatiente » posé par la RC ou le SAV au moment de la relance
      const flagged = impatientAt(r, c.date);
      const reply = cs.slice(i + 1).find((n) => isTarget(n));
      const hours = reply ? (new Date(reply.date) - new Date(c.date)) / 3600000 : null;
      rows.push({
        id: r.id,
        ref: r.ref,
        commentId: c.id,
        date: c.date,
        author: strip(c.author),
        service: author?.role || SANS_COMPTE,
        target: target.length ? target.join(', ') : targetNames[0] || 'Service Litige',
        kind: k.c,
        relance: k.c === 'relance',
        client: k.client || flagged,
        flagged,
        source: known ? 'historique' : 'regles',
        replyHours: hours !== null && hours >= 0 ? Math.round(hours * 10) / 10 : null,
        text: text.slice(0, 300),
      });
    });
  }
  return rows;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Chiffres de l'écran : sur des lignes déjà filtrées par période */
export function relanceStats(rows) {
  const rel = rows.filter((r) => r.relance);
  const group = (by) => {
    const m = new Map();
    for (const r of rel) {
      const k = by(r);
      const g = m.get(k) || { key: k, relances: 0, dossiers: new Set(), client: 0, hours: [] };
      g.relances++;
      g.dossiers.add(r.id);
      if (r.client) g.client++;
      if (r.replyHours !== null) g.hours.push(r.replyHours);
      m.set(k, g);
    }
    return [...m.values()]
      .map((g) => ({
        key: g.key,
        relances: g.relances,
        dossiers: g.dossiers.size,
        client: g.client,
        medianReplyHours: median(g.hours),
      }))
      .sort((a, b) => b.relances - a.relances || a.key.localeCompare(b.key, 'fr'));
  };
  const perDossier = new Map();
  for (const r of rel) {
    const d = perDossier.get(r.id) || { id: r.id, ref: r.ref, relances: 0, client: 0, last: '' };
    d.relances++;
    if (r.client) d.client++;
    if (String(r.date) > d.last) d.last = String(r.date);
    perDossier.set(r.id, d);
  }
  const hours = rel.map((r) => r.replyHours).filter((h) => h !== null);
  return {
    tags: rows.length,
    relances: rel.length,
    share: rows.length ? Math.round((rel.length / rows.length) * 100) : null,
    dossiers: perDossier.size,
    client: rel.filter((r) => r.client).length,
    medianReplyHours: median(hours),
    unanswered: rel.filter((r) => r.replyHours === null).length,
    byAgent: group((r) => r.author),
    byService: group((r) => r.service),
    byTarget: group((r) => r.target),
    byMonth: group((r) => String(r.date).slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)),
    topDossiers: [...perDossier.values()]
      .sort((a, b) => b.relances - a.relances || b.last.localeCompare(a.last))
      .slice(0, 15),
  };
}
