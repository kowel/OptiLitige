// Filtres avancés de la liste des dossiers et vues enregistrées par agent.

export const EMPTY_ADVANCED = {
  brand: '',
  carrier: '',
  type: '',
  productType: '',
  source: '', // service du créateur : RC, SAV, import
  min: '',
  max: '',
  credit: '', // with = au moins un avoir (émis ou demandé), without = aucun
};

export const SOURCE_LABELS = {
  RC: 'Relation client',
  SAV: 'SAV',
  import: 'Repris de l’ancienne liste',
};

// Repères de montant dans la liste (réglables par les responsables, Paramètres → Repères de
// montant) : contour orangé à partir de « orange » €, rouge à partir de « red » € (0 = désactivé)
export const DEFAULT_AMOUNT_ALERTS = { orange: 2000, red: 7500 };
export const HIGH_AMOUNT = DEFAULT_AMOUNT_ALERTS.orange;
export const VERY_HIGH_AMOUNT = DEFAULT_AMOUNT_ALERTS.red;

// Contrôle et nettoie les seuils envoyés ; renvoie { alerts } ou { error }
export function normalizeAmountAlerts(input) {
  const read = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));
  const orange = read(input?.orange),
    red = read(input?.red);
  for (const v of [orange, red])
    if (!Number.isFinite(v) || v < 0 || v > 10_000_000)
      return { error: 'Seuils invalides (montants positifs, 0 pour désactiver).' };
  if (orange && red && red <= orange)
    return { error: 'Le seuil rouge doit être supérieur au seuil orange.' };
  return { alerts: { orange: Math.round(orange * 100) / 100, red: Math.round(red * 100) / 100 } };
}

const euros = (v) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);

// Montant concerné par le litige (saisi à la création) ; pour les anciens dossiers repris de
// SharePoint sans ce montant, le montant de la commande
export const stakeOf = (record) =>
  Number(record?.disputeValue) > 0 ? Number(record.disputeValue) : Number(record?.amount) || 0;

export const isHighAmount = (record, alerts = DEFAULT_AMOUNT_ALERTS) =>
  !!alerts.orange && stakeOf(record) >= alerts.orange;

// Repère de la ligne dans la liste : classe CSS et info-bulle, ou rien sous le seuil orange
export function amountMark(record, alerts = DEFAULT_AMOUNT_ALERTS) {
  const amount = stakeOf(record);
  if (alerts.red && amount >= alerts.red)
    return { className: 'very-high-amount', title: 'Montant de ' + euros(alerts.red) + ' ou plus' };
  if (alerts.orange && amount >= alerts.orange)
    return { className: 'high-amount', title: 'Montant de ' + euros(alerts.orange) + ' ou plus' };
  return { className: undefined, title: undefined };
}

const amount = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

// Service du créateur d'un dossier
export function sourceOf(record, members = []) {
  if (String(record?.id || '').startsWith('import-')) return 'import';
  return members.find((m) => m.email === record?.creator)?.role || '';
}

export function hasCredit(record) {
  return (
    !!record?.creditIssued ||
    !!String(record?.creditNumber || '').trim() ||
    (record?.credits || []).some((c) => !['refused', 'cancelled'].includes(c.status))
  );
}

export function matchesAdvanced(record, adv, members = []) {
  const a = { ...EMPTY_ADVANCED, ...(adv || {}) };
  if (a.brand && record.brand !== a.brand) return false;
  if (a.carrier && record.carrier !== a.carrier) return false;
  if (a.type && record.type !== a.type) return false;
  if (a.productType && record.productType !== a.productType) return false;
  if (a.source && sourceOf(record, members) !== a.source) return false;
  const min = amount(a.min),
    max = amount(a.max),
    value = stakeOf(record);
  if (min !== null && Number.isFinite(min) && value < min) return false;
  if (max !== null && Number.isFinite(max) && value > max) return false;
  if (a.credit === 'with' && !hasCredit(record)) return false;
  if (a.credit === 'without' && hasCredit(record)) return false;
  return true;
}

export function countAdvanced(adv) {
  return Object.entries({ ...EMPTY_ADVANCED, ...(adv || {}) }).filter(
    ([, v]) => v !== '' && v !== null,
  ).length;
}

// --- Vues enregistrées ---------------------------------------------------------------
export const MAX_VIEWS = 20;
const str = (v, max) => String(v ?? '').slice(0, max);

// Vérifie et nettoie les vues envoyées par un agent. Renvoie { views } ou { error }.
export function normalizeViews(input) {
  if (!Array.isArray(input) || input.length > MAX_VIEWS)
    return { error: 'Vous pouvez enregistrer jusqu’à ' + MAX_VIEWS + ' vues.' };
  const views = [];
  for (const v of input) {
    const name = str(v?.name, 60).trim();
    if (!name) return { error: 'Donnez un nom à la vue.' };
    const f = v?.filters || {};
    const adv = {};
    for (const k of Object.keys(EMPTY_ADVANCED)) adv[k] = str(f.adv?.[k], 120);
    views.push({
      id: str(v.id, 40).replace(/[^\w-]/g, '') || 'vue-' + views.length,
      name,
      filters: {
        q: str(f.q, 200),
        status: str(f.status, 40),
        origin: str(f.origin, 40),
        scope: str(f.scope, 80),
        period: str(f.period, 40),
        adv,
      },
    });
  }
  return { views };
}

// Vues partagées par service : chaque vue appartient au rôle de son créateur (RC, SAV,
// Service Litige, Responsable, Admin) et n'est visible que par les comptes de ce rôle.
export const viewsKey = (role) => 'views-role:' + String(role || '');

// Ajoute ou supprime une vue dans la liste du service. Renvoie { views, message } ou { error }.
export function applyViewAction(list, b, member, now, newId) {
  const views = Array.isArray(list) ? [...list] : [];
  if (b.action === 'view-add') {
    if (views.length >= MAX_VIEWS)
      return { error: 'Votre service a déjà ' + MAX_VIEWS + ' vues : supprimez-en une d’abord.' };
    const { views: clean, error } = normalizeViews([{ ...b.view, id: newId }]);
    if (error) return { error };
    if (views.some((v) => v.name.toLowerCase() === clean[0].name.toLowerCase()))
      return { error: 'Une vue porte déjà ce nom dans votre service.' };
    views.push({
      ...clean[0],
      createdBy: member.email,
      createdByName: member.name,
      createdAt: now,
    });
    return { views, message: 'Vue enregistrée pour votre service' };
  }
  if (b.action === 'view-delete') {
    const kept = views.filter((v) => v.id !== b.id);
    if (kept.length === views.length) return { error: 'Vue introuvable.' };
    return { views: kept, message: 'Vue supprimée' };
  }
  return { error: 'Action inconnue' };
}
