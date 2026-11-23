import { stakeOf } from './advanced-filters.mjs';
import { openCredits } from './credit-requests.mjs';
export const kpiScopes = [
  'En attente de réponse RC',
  'Nouveaux à prendre en charge',
  'Litiges ouverts',
  'Mes dossiers ouverts',
  'Dossiers non attribués',
  'Avoirs à traiter',
  'Commandes concernées',
  'Avoirs enregistrés',
  'Avoirs en attente',
  'Montant moyen des litiges',
  'Clôtures datées',
];
export function kpiRows(records, scope, email) {
  return records.filter((r) => {
    switch (scope) {
      case 'En attente de réponse RC':
        return r.status === 'En attente RC';
      case 'Nouveaux à prendre en charge':
        return r.status === 'Nouveau';
      case 'Litiges ouverts':
        return r.status !== 'Résolu';
      case 'Mes dossiers ouverts':
        return r.creator === email && r.status !== 'Résolu';
      case 'Dossiers non attribués':
        return !r.assignee && r.status !== 'Résolu';
      case 'Avoirs à traiter':
      case 'Avoirs en attente':
        return openCredits(r).length > 0;
      case 'Montant moyen des litiges':
        return true;
      case 'Avoirs enregistrés':
        return !!r.creditIssued || !!String(r.creditNumber || '').trim() || Number(r.credit) > 0;
      case 'Clôtures datées':
        return (
          r.status === 'Résolu' &&
          !!r.created &&
          !!r.closed &&
          Number.isFinite(+new Date(r.created)) &&
          Number.isFinite(+new Date(r.closed)) &&
          new Date(r.closed) >= new Date(r.created)
        );
      default:
        return true;
    }
  });
}
export function kpiCards(records, view, email) {
  if (view === 'SAV') view = 'RC'; // le SAV a le même tableau de bord que la RC
  const scopes = [
    view === 'RC'
      ? 'En attente de réponse RC'
      : view === 'Service Litige'
        ? 'Nouveaux à prendre en charge'
        : 'Litiges ouverts',
    view === 'RC'
      ? 'Mes dossiers ouverts'
      : view === 'Service Litige'
        ? 'Avoirs à traiter'
        : 'Commandes concernées',
    // Troisième carte : RC et SAV, nombre d'avoirs en attente ; Service Litige, montant moyen
    // des litiges ; admins, avoirs enregistrés
    view === 'RC'
      ? 'Avoirs en attente'
      : view === 'Service Litige'
        ? 'Montant moyen des litiges'
        : 'Avoirs enregistrés',
    'Clôtures datées',
  ];
  return scopes.map((scope, i) => {
    const rows = kpiRows(records, scope, email);
    const value =
      i === 3
        ? rows.length
          ? rows.reduce((n, r) => n + (new Date(r.closed) - new Date(r.created)) / 86400000, 0) /
            rows.length
          : 0
        : scope === 'Avoirs en attente'
          ? rows.reduce((n, r) => n + openCredits(r).length, 0)
          : scope === 'Montant moyen des litiges'
            ? rows.length
              ? rows.reduce((n, r) => n + stakeOf(r), 0) / rows.length
              : 0
            : i === 2
              ? rows.reduce((n, r) => n + Number(r.credit || 0), 0)
              : scope === 'Commandes concernées'
                ? rows.reduce((n, r) => n + stakeOf(r), 0)
                : rows.length;
    return {
      scope,
      label: i === 3 ? 'Délai moyen de résolution' : scope,
      rows,
      value,
      kind:
        i === 3
          ? 'days'
          : scope === 'Avoirs en attente'
            ? 'count'
            : i === 2 || scope === 'Commandes concernées'
              ? 'money'
              : 'count',
    };
  });
}
