'use client';
import { useState } from 'react';
import {
  AlertTriangle,
  FileText,
  CalendarRange,
  ChartColumn,
  Coins,
  Layers,
  ListTree,
  Scale,
  Store,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { ChartCard, StatChart } from './dashboard-visuals';
import PeriodPicker from './period-picker';
import { inPeriod } from './period.mjs';
import {
  CONTENTIEUX_REPORT_NOTE,
  contentieuxDashboard,
  contentieuxReport,
  contentieuxReportRanks,
  contentieuxReportTiles,
} from './contentieux.mjs';
import ReportView from './report-view';
import ReportPeriod from './report-period';
import type { ReportPeriodValue } from './report-period';
import {
  lastClosedPeriod,
  monthPeriod,
  previousPeriod,
  rangeError,
  rangePeriod,
} from './reports.mjs';
import type { Contentieux, ContentieuxSettings, Dossier } from './types';

// Analyses contentieux (responsables) : le tableau de bord du fichier « Contentieux 2026 »
// (onglets Tableau de bord et Évolution annuelle), calculé à partir de l'espace Contentieux.
// Période et filtres s'appliquent à tout l'écran. Calculs : contentieuxDashboard
// (app/contentieux.mjs).

interface Props {
  items: Contentieux[];
  records: Dossier[];
  settings: ContentieuxSettings;
  brands: string[];
  today: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function ContentieuxDashboard({ items, records, settings, brands, today }: Props) {
  const [period, setPeriod] = useState('99999');
  const [kind, setKind] = useState('');
  const [brand, setBrand] = useState('');
  // Rapport (PDF) : mois précédent par défaut, ou dates choisies ; mêmes filtres que l'écran
  const [report, setReport] = useState<ReportPeriodValue | null>(null);
  const list = items.filter(
    (c) =>
      inPeriod(c.receivedAt + 'T12:00:00.000Z', period) &&
      (!kind || c.kind === kind) &&
      (!brand || c.brand === brand),
  );
  const d = contentieuxDashboard(list, records, settings, today);
  const max = Math.max(1, ...d.months.map((m) => m.total));
  const kindsShown = d.byKind.map((k) => k.label);
  return (
    <div className="ct-dashboard">
      <div className="analytics-filter ct-dashboard-filter">
        <label>
          Période de réception
          <PeriodPicker value={period} onChange={setPeriod} label="Période de réception" />
        </label>
        <label>
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Tous les types</option>
            {settings.kinds.map((k) => (
              <option key={k.id}>{k.id}</option>
            ))}
          </select>
        </label>
        <label>
          Enseigne
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Toutes les enseignes</option>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="secondary ct-report-btn"
          onClick={() => setReport({ kind: 'monthly', periodKey: lastClosedPeriod('monthly').key })}
        >
          <FileText size={15} /> Rapport (PDF)
        </button>
      </div>
      {report &&
        (() => {
          const error =
            report.kind === 'range' ? rangeError(report.from || '', report.to || '') : '';
          const p =
            report.kind === 'range' && !error
              ? rangePeriod(report.from || '', report.to || '')
              : monthPeriod(
                  report.kind === 'range' ? lastClosedPeriod('monthly').key : report.periodKey,
                );
          const filtered = items.filter(
            (c) => (!kind || c.kind === kind) && (!brand || c.brand === brand),
          );
          const data = contentieuxReport(
            filtered,
            records,
            p,
            previousPeriod(p),
            [kind && 'Type : ' + kind, brand && 'Enseigne : ' + brand].filter(Boolean) as string[],
            settings,
            today,
          );
          return (
            <ReportView
              title="Rapport des contentieux"
              data={data}
              tiles={contentieuxReportTiles(data)}
              ranks={contentieuxReportRanks(data)}
              note={CONTENTIEUX_REPORT_NOTE}
              empty="Tous les contentieux"
              blocked={error}
              onClose={() => setReport(null)}
              toolbar={
                <ReportPeriod
                  value={report}
                  onChange={(v) => setReport({ ...report, ...v })}
                  error={error}
                />
              }
            />
          );
        })()}

      <div className="analytics-summary">
        <div>
          <span className="summary-icon violet">
            <Scale size={19} />
          </span>
          <small>Contentieux de la période</small>
          <strong>{d.total}</strong>
        </div>
        <div>
          <span className="summary-icon amber">
            <AlertTriangle size={19} />
          </span>
          <small>À traiter · délai dépassé</small>
          <strong>
            {d.open}
            <em> · {d.late}</em>
          </strong>
        </div>
        <div>
          <span className="summary-icon blue">
            <Wallet size={19} />
          </span>
          <small>Coût des contentieux</small>
          <strong>{money(d.cost)}</strong>
        </div>
        <div>
          <span className="summary-icon teal">
            <TrendingDown size={19} />
          </span>
          <small>Perte réelle</small>
          <strong>{money(d.loss)}</strong>
        </div>
      </div>

      <div className="ct-dashboard-grid">
        <ChartCard title="Par type" subtitle="Nombre de contentieux de chaque type" icon={Scale}>
          <StatChart id="ct-kinds" label="Par type" rows={d.byKind} fallback="donut" />
        </ChartCard>
        <ChartCard title="Par sujet" subtitle="Pourquoi le client fait ce recours" icon={Layers}>
          <StatChart id="ct-subjects" label="Par sujet" rows={d.bySubject} />
        </ChartCard>
        <ChartCard
          title="Sous-sujets les plus fréquents"
          subtitle="Les 10 premiers, avec leur sujet"
          icon={ListTree}
          className="wide"
        >
          <StatChart id="ct-subs" label="Sous-sujets" rows={d.bySubSubject} />
        </ChartCard>
        <ChartCard
          title="Évolution sur 12 mois"
          subtitle="Contentieux reçus chaque mois, par type"
          icon={CalendarRange}
          className="wide"
        >
          {d.months.some((m) => m.total) ? (
            <>
              <div className="ct-months" role="img" aria-label="Contentieux reçus par mois">
                {d.months.map((m) => (
                  <div key={m.key} className="ct-month" title={m.label + ' : ' + m.total}>
                    <b>{m.total || ''}</b>
                    <div className="ct-month-track">
                      <div className="ct-month-bar" style={{ height: (m.total / max) * 100 + '%' }}>
                        {kindsShown.map((k) =>
                          m.byKind[k] ? (
                            <i
                              key={k}
                              title={k + ' : ' + m.byKind[k]}
                              style={{
                                flexGrow: m.byKind[k],
                                background: d.byKind.find((x) => x.label === k)?.color,
                              }}
                            />
                          ) : null,
                        )}
                      </div>
                    </div>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="ct-legend">
                {d.byKind.map((k) => (
                  <span key={k.label}>
                    <i style={{ background: k.color }} />
                    {k.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="muted ct-empty">Aucun contentieux reçu sur les 12 derniers mois.</p>
          )}
        </ChartCard>
        <ChartCard
          title="Montants par type"
          subtitle="Remboursé / avoir, majorations, frais, écart de prix et perte réelle"
          icon={Coins}
          className="wide"
        >
          <div className="table-scroll">
            <table className="visual-table ct-money-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Nombre</th>
                  <th>Remboursé / avoir</th>
                  <th>Majorations</th>
                  <th>Frais</th>
                  <th>Écart de prix</th>
                  <th>Coût</th>
                  <th>Perte réelle</th>
                </tr>
              </thead>
              <tbody>
                {d.byKindMoney.map((r) => (
                  <tr key={r.kind}>
                    <td>
                      <i style={{ background: r.color }} />
                      {r.kind}
                    </td>
                    <td>{r.count}</td>
                    <td>{money(r.refund)}</td>
                    <td>{money(r.surcharge)}</td>
                    <td>{money(r.fees)}</td>
                    <td>{money(r.priceGap)}</td>
                    <td>{money(r.cost)}</td>
                    <td>
                      <b>{money(r.loss)}</b>
                    </td>
                  </tr>
                ))}
                {d.byKindMoney.length > 0 && (
                  <tr className="ct-total-row">
                    <td>Total</td>
                    <td>{d.total}</td>
                    <td>{money(d.refund)}</td>
                    <td>{money(d.byKindMoney.reduce((s, r) => s + r.surcharge, 0))}</td>
                    <td>{money(d.byKindMoney.reduce((s, r) => s + r.fees, 0))}</td>
                    <td>{money(d.priceGap)}</td>
                    <td>{money(d.cost)}</td>
                    <td>
                      <b>{money(d.loss)}</b>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="ct-note">
            Perte réelle = coût moins l’indemnisation transporteur des dossiers litiges reliés (
            {d.linked} contentieux relié{d.linked > 1 ? 's' : ''}, {money(d.deducted)} déduits).
          </p>
        </ChartCard>
        <ChartCard title="Par enseigne" subtitle="Nombre de contentieux" icon={Store}>
          <StatChart id="ct-brands" label="Par enseigne" rows={d.byBrand} />
        </ChartCard>
        <ChartCard title="Décisions" subtitle="Décision prise suite au contentieux" icon={Scale}>
          <StatChart id="ct-decisions" label="Décisions" rows={d.byDecision} />
        </ChartCard>
        <ChartCard
          title="Comparatif annuel"
          subtitle="Nombre de contentieux par type et par année de réception"
          icon={ChartColumn}
          className="wide"
        >
          {d.years.length ? (
            <table className="visual-table ct-years-table">
              <thead>
                <tr>
                  <th>Type</th>
                  {d.years.map((y) => (
                    <th key={y}>{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.byYear.map((r) => (
                  <tr key={r.kind}>
                    <td>
                      <i style={{ background: r.color }} />
                      {r.kind}
                    </td>
                    {d.years.map((y) => (
                      <td key={y}>{r.years[y] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted ct-empty">Aucun contentieux sur la période.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
