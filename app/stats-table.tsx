'use client';
import { useState } from 'react';
import { Download, Truck } from 'lucide-react';
import { STAT_COLUMNS, STAT_DIMENSIONS, groupStats, statsCsv } from './stats.mjs';
import { inPeriod, periodLabel } from './period.mjs';
import type { Dossier, Member, SlaRule } from './types';
import BrandName from './brand-name';

// Valeur d'une cellule : nombre calculé, ou null quand il n'y a pas de donnée
type StatValue = string | number | null | undefined;
// Ligne de statistiques : nom du groupe + une valeur par colonne (app/stats.mjs)
type StatRow = { key: string } & Record<string, StatValue>;

interface StatsTableProps {
  records: Dossier[];
  members: Member[];
  rules: SlaRule[];
  period: string;
  slaNow: number;
  /** Expéditions par mois et par transporteur (app/carrier-tracking.mjs) */
  shipments?: Record<string, Record<string, number>>;
}

const euros = (v: StatValue) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

// Mise en forme d'une cellule selon la colonne
function show(key: string, v: StatValue) {
  if (v === null || v === undefined) return '—';
  if (
    ['compensation', 'credits', 'carrierCredits', 'gap', 'stake', 'avgStake', 'netLoss'].includes(
      key,
    )
  )
    return euros(v);
  if (key.endsWith('Rate') || key === 'share') return String(v).replace('.', ',') + ' %';
  if (key.endsWith('Days')) return String(v).replace('.', ',') + ' j';
  return v;
}
// Couleur d'alerte : peu de réponses dans le délai, ou faible récupération
const tone = (key: string, v: number | null | undefined) =>
  v === null || v === undefined
    ? ''
    : (key === 'onTimeRate' || key === 'recoveryRate') && v < 50
      ? 'bad'
      : (key === 'onTimeRate' || key === 'recoveryRate') && v >= 80
        ? 'good'
        : '';

// Statistiques par transporteur / enseigne / agent, avec export CSV.
export default function StatsTable({
  records,
  members,
  rules,
  period,
  slaNow,
  shipments,
}: StatsTableProps) {
  const [by, setBy] = useState('carrier');
  if (!slaNow) return null;
  const rows = records.filter((r) => inPeriod(r.created, period, slaNow));
  const name = (email: string) => members?.find((m) => m.email === email)?.name || email;
  const result = groupStats(rows, by, {
    rules,
    now: slaNow,
    label: by === 'assignee' ? name : (k: string) => k,
    shipments: shipments && Object.keys(shipments).length ? shipments : null,
    // Un mois d'expéditions compte si son milieu tombe dans la période choisie
    keepMonth: (month: string) => inPeriod(month + '-15T12:00:00Z', period, slaNow),
  });
  const dimension = (STAT_DIMENSIONS as Record<string, string>)[by];

  function exportCsv() {
    const blob = new Blob([statsCsv(result, dimension)], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'optilitige-statistiques-' + by + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="panel stats-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <Truck size={18} /> Statistiques par {dimension.toLowerCase()}
          </h2>
          <span className="muted">
            Dossiers ouverts{' '}
            {periodLabel(period) ? '· ' + periodLabel(period) : 'sur la période choisie'}
            {by === 'carrier' ? ' · dossiers d’origine Transport uniquement' : ''}
            {by === 'store' ? ' · dossiers de l’enseigne MAGASIN uniquement' : ''}
          </span>
        </div>
        <div className="stats-actions">
          <div className="stats-tabs" role="tablist">
            {Object.entries(STAT_DIMENSIONS).map(([k, v]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={by === k}
                className={by === k ? 'active' : ''}
                onClick={() => setBy(k)}
              >
                {v as string}
              </button>
            ))}
          </div>
          <button type="button" className="secondary" onClick={exportCsv}>
            <Download size={15} /> Exporter
          </button>
        </div>
      </div>
      {result.rows.length ? (
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>{dimension}</th>
                {STAT_COLUMNS.map(([k, l]) => (
                  <th key={k}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...result.rows, result.total].map((row: StatRow) => (
                <tr key={row.key} className={row === result.total ? 'stats-total' : ''}>
                  <td>
                    {by === 'brand' && row !== result.total ? (
                      <BrandName brand={row.key} />
                    ) : (
                      row.key
                    )}
                  </td>
                  {STAT_COLUMNS.map(([k]) => (
                    <td key={k} className={tone(k, row[k] as number | null)}>
                      {show(k, row[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted stats-empty">Aucun dossier sur cette période.</p>
      )}
      <ul className="stats-notes">
        <li>
          <b>Avérés</b> : part des dossiers clôturés « Avéré » parmi ceux qualifiés (avéré ou non
          avéré).
        </li>
        <li>
          <b>Réponses dans le délai</b> : réponses du transporteur reçues dans le délai réglé dans
          Paramètres → Délais (« Réponse du transporteur », 15 jours par défaut). Un dossier sans
          réponse au-delà du délai compte comme hors délai ; un dossier sans réponse encore dans le
          délai n’est pas compté.
        </li>
        <li>
          <b>Taux de récupération</b> : indemnisations obtenues ÷ avoirs émis imputés au
          transporteur, sur les seuls dossiers ayant une demande d’avoir avec l’imputation «
          Transporteur ».
        </li>
        <li>
          <b>Acceptés / refusés par le transporteur</b> : décision du transporteur (« Accepté », «
          Partiel » compté comme accepté, « Refusé ») parmi les dossiers où elle est connue.
        </li>
        <li>
          <b>Écart d’indemnisation</b> : valeur du litige TTC moins l’indemnisation reçue.{' '}
          <b>Avoirs anticipés</b> : avoirs émis avant la réponse du transporteur.
        </li>
        <li>
          <b>Litiges / expéditions</b> : dossiers d’origine Transport ÷ expéditions des mois de la
          période (reçues de l’outil d’expédition, ou saisies dans Paramètres → Expéditions).
        </li>
        <li>
          <b>Montant en jeu</b> : montant concerné des dossiers. <b>Reste à notre charge</b> :
          avoirs imputés au transporteur moins les indemnisations obtenues sur ces dossiers.{' '}
          <b>Type de litige principal</b> : le plus fréquent, avec sa part.
        </li>
        <li>
          <b>Délais</b> : transporteur, de la transmission à la clôture de son dossier ; client, de
          l’ouverture à la solution client définitive ; dossier, de l’ouverture à la clôture.
        </li>
      </ul>
    </section>
  );
}
