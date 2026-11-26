'use client';
import { Download, HandCoins } from 'lucide-react';
import { carrierCostStats } from './carrier-cost.mjs';
import { csvCell } from './csv.mjs';
import DossierRecap from './dossier-recap';
import { inPeriod, periodLabel } from './period.mjs';
import type { Dossier, Member } from './types';

interface CarrierCostPanelProps {
  records: Dossier[];
  members: Member[];
  period: string;
  slaNow: number;
  onOpen: (record: Dossier) => void;
}

type CostRow = {
  key: string;
  dossiers: number;
  refundedCount: number;
  compensatedCount: number;
  value: number;
  refunded: number;
  compensated: number;
  covered: number;
  netLoss: number;
  coverageRate: number | null;
  avgCompensation: number | null;
  avgNetLoss: number | null;
};

const euros = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(Number(v) || 0);
const pct = (v: number | null) => (v === null ? '—' : v + ' %');

const COLUMNS: [keyof CostRow, string][] = [
  ['dossiers', 'Dossiers faute transporteur'],
  ['value', 'Valeur des litiges'],
  ['refunded', 'Remboursé aux clients'],
  ['covered', 'Indemnisé par le transporteur'],
  ['netLoss', 'Reste à notre charge'],
  ['coverageRate', 'Couverture'],
  ['avgCompensation', 'Indemnisation moyenne'],
  ['avgNetLoss', 'Reste à charge moyen'],
];
const cell = (k: keyof CostRow, row: CostRow) =>
  k === 'dossiers'
    ? String(row.dossiers)
    : k === 'coverageRate'
      ? pct(row.coverageRate)
      : euros(row[k] as number | null);

// Analyses litiges : ce que nous coûtent les transporteurs (avoirs remboursés aux clients moins
// leurs indemnisations, souvent forfaitaires), par transporteur, pour les négociations de contrat.
export default function CarrierCostPanel({
  records,
  members,
  period,
  slaNow,
  onOpen,
}: CarrierCostPanelProps) {
  if (!slaNow) return null;
  const rows = records.filter((r) => inPeriod(r.created, period, slaNow));
  const {
    rows: carriers,
    total,
    top,
  } = carrierCostStats(rows) as {
    rows: CostRow[];
    total: CostRow;
    top: ({ record: Dossier } & Pick<CostRow, 'value' | 'refunded' | 'compensated' | 'netLoss'>)[];
  };
  const agent = (email?: string) =>
    email ? members.find((m) => m.email === email)?.name || email : '';
  const worst = Math.max(...carriers.map((c) => c.netLoss), 1);

  function exportCsv() {
    const lines = [
      ['Transporteur', ...COLUMNS.map(([, l]) => l)],
      ...[...carriers, total].map((row) => [
        row.key,
        ...COLUMNS.map(([k]) =>
          row[k] === null || row[k] === undefined ? '' : String(row[k]).replace('.', ','),
        ),
      ]),
    ];
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'optilitige-cout-transporteurs.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="panel stats-panel carrier-cost">
      <div className="panel-heading">
        <div>
          <h2>
            <HandCoins size={18} /> Coût des transporteurs : ce qui reste à notre charge
          </h2>
          <span className="muted">
            Litiges d’origine Transport dont la faute revient au transporteur · dossiers ouverts{' '}
            {periodLabel(period) ? '· ' + periodLabel(period) : 'sur la période choisie'}
          </span>
        </div>
        <button type="button" className="secondary" onClick={exportCsv}>
          <Download size={15} /> Exporter
        </button>
      </div>
      <div className="carrier-cost-kpis">
        <div>
          <span>Remboursé aux clients</span>
          <b>{euros(total.refunded)}</b>
          <small>{total.refundedCount} dossier(s) avec un avoir</small>
        </div>
        <div>
          <span>Indemnisé par les transporteurs</span>
          <b>{euros(total.covered)}</b>
          <small>sur ces mêmes dossiers</small>
        </div>
        <div className="loss">
          <span>Reste à notre charge</span>
          <b>{euros(total.netLoss)}</b>
          <small>
            {total.avgNetLoss !== null ? euros(total.avgNetLoss) + ' en moyenne par dossier' : ''}
          </small>
        </div>
        <div>
          <span>Couverture par les transporteurs</span>
          <b>{pct(total.coverageRate)}</b>
          <small>de ce que nous remboursons</small>
        </div>
      </div>
      {carriers.length ? (
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Transporteur</th>
                {COLUMNS.map(([k, l]) => (
                  <th key={k}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...carriers, total].map((row) => (
                <tr key={row.key} className={row === total ? 'stats-total' : ''}>
                  <td>{row.key}</td>
                  {COLUMNS.map(([k]) => (
                    <td
                      key={k}
                      className={
                        k === 'coverageRate' && row.coverageRate !== null
                          ? row.coverageRate < 30
                            ? 'bad'
                            : row.coverageRate >= 80
                              ? 'good'
                              : ''
                          : ''
                      }
                    >
                      {k === 'netLoss' && row !== total ? (
                        <span className="carrier-cost-bar">
                          <i style={{ width: Math.round((row.netLoss / worst) * 100) + '%' }} />
                          {cell(k, row)}
                        </span>
                      ) : (
                        cell(k, row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted stats-empty">
          Aucun litige imputable à un transporteur sur cette période.
        </p>
      )}
      {top.length > 0 && (
        <div className="carrier-cost-top">
          <h3>Les plus gros restes à charge</h3>
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Transporteur</th>
                  <th>Valeur du litige</th>
                  <th>Remboursé au client</th>
                  <th>Indemnisé</th>
                  <th>Reste à notre charge</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {top.map((t) => (
                  <tr key={t.record.id}>
                    <td>
                      <button type="button" className="text-btn" onClick={() => onOpen(t.record)}>
                        {t.record.ref}
                      </button>{' '}
                      <span className="muted">{t.record.title}</span>
                    </td>
                    <td>{t.record.carrier || 'Non renseigné'}</td>
                    <td>{euros(t.value)}</td>
                    <td>{euros(t.refunded)}</td>
                    <td>{euros(t.compensated)}</td>
                    <td className="bad">{euros(t.netLoss)}</td>
                    <td className="row-end">
                      <DossierRecap r={t.record} agent={agent(t.record.assignee)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ul className="stats-notes">
        <li>
          <b>Périmètre</b> : litiges d’origine Transport, sauf ceux imputés Interne ou Autre et ceux
          où le transporteur a répondu « Ne concerne pas le transporteur ».
        </li>
        <li>
          <b>Remboursé aux clients</b> : avoirs émis sur ces dossiers (champ Avoir du dossier et
          demandes d’avoir émises). <b>Indemnisé</b> : indemnisation du transporteur saisie dans le
          suivi transporteur.
        </li>
        <li>
          <b>Reste à notre charge</b> : remboursé moins indemnisé, dossier par dossier (une
          indemnisation supérieure à l’avoir ne compense pas les autres dossiers). <b>Couverture</b>{' '}
          : indemnisations ÷ remboursements, sur les dossiers remboursés.
        </li>
        <li>
          Un produit renvoyé au client sans avoir n’apparaît pas dans « Remboursé » : sa valeur
          reste visible dans « Valeur des litiges ».
        </li>
      </ul>
    </section>
  );
}
