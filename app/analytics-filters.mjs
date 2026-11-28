// Filtres de l'écran « Analyses & rapports » : ils s'appliquent à tout l'écran (indicateurs,
// graphiques, issues des litiges et tableau de statistiques du bas), en plus de la période.
import { SOURCE_LABELS, hasCredit, sourceOf } from './advanced-filters.mjs';
import { ownerOf } from './dashboard-data.mjs';

export const EMPTY_ANALYTICS = {
  brand: '',
  store: '',
  carrier: '',
  type: '',
  productType: '',
  origin: '',
  source: '', // service du créateur : RC, SAV, import
  assignee: '', // e-mail de l'agent qui a créé le dossier, ou « none » : auteur sans compte
  priority: '', // urgent | normal
  credit: '', // with | without
  imputation: '', // Interne | Transporteur | Autre | none (non précisée)
};

export const ANALYTICS_LABELS = {
  brand: 'Enseigne',
  store: 'Magasin',
  carrier: 'Transporteur',
  type: 'Type de litige',
  productType: 'Type de produit',
  origin: 'Origine',
  source: 'Service créateur',
  assignee: 'Agent (créateur)',
  priority: 'Priorité',
  credit: 'Avoir',
  imputation: 'Imputation',
};

const isUrgent = (r) => ['Urgente', 'Haute', 'urgent', 'high'].includes(String(r?.priority || ''));

export function matchesAnalytics(record, filters, members = []) {
  const f = { ...EMPTY_ANALYTICS, ...(filters || {}) };
  if (f.brand && record.brand !== f.brand) return false;
  if (f.store && record.store !== f.store) return false;
  if (f.carrier && record.carrier !== f.carrier) return false;
  if (f.type && record.type !== f.type) return false;
  if (f.productType && record.productType !== f.productType) return false;
  if (f.origin && record.origin !== f.origin) return false;
  if (f.source && sourceOf(record, members) !== f.source) return false;
  if (f.assignee === 'none' && members.some((m) => m.email === ownerOf(record))) return false;
  if (f.assignee && f.assignee !== 'none' && ownerOf(record) !== f.assignee) return false;
  if (f.priority === 'urgent' && !isUrgent(record)) return false;
  if (f.priority === 'normal' && isUrgent(record)) return false;
  if (f.credit === 'with' && !hasCredit(record)) return false;
  if (f.credit === 'without' && hasCredit(record)) return false;
  if (f.imputation === 'none' && record.imputation) return false;
  if (f.imputation && f.imputation !== 'none' && record.imputation !== f.imputation) return false;
  return true;
}

export const countAnalytics = (filters) =>
  Object.values({ ...EMPTY_ANALYTICS, ...(filters || {}) }).filter(Boolean).length;

export function filterAnalytics(records, filters, members = []) {
  if (!countAnalytics(filters)) return records;
  return records.filter((r) => matchesAnalytics(r, filters, members));
}

// Filtres actifs en clair (« Enseigne : GROSBILL »…) : bandeau de la liste ouverte depuis les analyses
const VALUE_LABELS = {
  assignee: { none: 'Auteur sans compte' },
  priority: { urgent: 'Urgents seulement', normal: 'Hors urgents' },
  credit: { with: 'Avec avoir', without: 'Sans avoir' },
  imputation: { none: 'Non précisée' },
  source: SOURCE_LABELS,
};
export function describeAnalytics(filters, members = []) {
  const f = { ...EMPTY_ANALYTICS, ...(filters || {}) };
  return Object.keys(EMPTY_ANALYTICS)
    .filter((k) => f[k])
    .map((k) => {
      let v = VALUE_LABELS[k]?.[f[k]] || f[k];
      if (k === 'assignee' && f[k] !== 'none') {
        const m = members.find((x) => x.email === f[k]);
        v = m?.name || f[k];
      }
      return ANALYTICS_LABELS[k] + ' : ' + v;
    });
}
