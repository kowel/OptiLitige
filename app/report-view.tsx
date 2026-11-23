'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, X } from 'lucide-react';
import { REPORT_NOTE, reportFileName, reportRanks, reportTiles } from './reports.mjs';
import { downloadPdf, reportPdf } from './report-pdf.mjs';

type Figures = {
  opened: number;
  closed: number;
  openAtEnd: number;
  provenRate: number;
  avgDays: number;
  orderValue: number;
  frauds: number;
  fraudValue: number;
  credits: number;
  creditCount: number;
  compensation: number;
  decisions: Record<string, number>;
  byCarrier: [string, number][];
  byBrand: [string, number][];
  byType: [string, number][];
};
type Tile = { label: string; value: string; delta: { dir: string; text: string; tone: string } };
type RankDef = { title: string; rows: [string, number][]; total: number };
export interface ReportData {
  period: { key: string; label: string; kind: string };
  previous: { label: string };
  filters: string[];
  now: Figures;
  before: Figures;
}

function Rank({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div className="report-rank">
      <h3>{title}</h3>
      {rows.length ? (
        <table>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="num">{v}</td>
                <td className="bar">
                  <span style={{ width: (total ? (v / total) * 100 : 0) + '%' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Aucun dossier.</p>
      )}
    </div>
  );
}

// Rapport imprimable (PDF) d'une période, en surimpression de l'écran
export default function ReportView({
  title,
  data,
  onClose,
  toolbar,
  blocked,
  tiles: ownTiles,
  ranks: ownRanks,
  note = REPORT_NOTE,
  empty = 'Tous les dossiers',
}: {
  title: string;
  data:
    ReportData | { period: ReportData['period']; previous: { label: string }; filters: string[] };
  /** Rapport des contentieux : indicateurs, classements et note propres */
  tiles?: Tile[];
  ranks?: RankDef[];
  note?: string;
  /** Texte quand aucun filtre n'est choisi */
  empty?: string;
  onClose: () => void;
  toolbar?: React.ReactNode;
  /** Période invalide : le rapport n'est ni affiché ni téléchargeable */
  blocked?: string;
}) {
  useEffect(() => {
    document.body.classList.add('report-open');
    return () => document.body.classList.remove('report-open');
  }, []);
  const tiles = ownTiles || reportTiles(data as ReportData);
  const ranks = ownRanks || reportRanks(data as ReportData);
  const download = () =>
    downloadPdf(
      reportPdf({ title, data, edited: new Date(), tiles, ranks, note, empty }),
      reportFileName(title, data),
    );
  return createPortal(
    <div className="report-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="report-toolbar">
        {toolbar}
        <span className="spacer" />
        <button
          type="button"
          className="primary small-btn"
          onClick={download}
          disabled={!!blocked}
          title="Enregistre le rapport en fichier PDF sur votre ordinateur"
        >
          <Download size={15} /> Télécharger le PDF
        </button>
        <button
          type="button"
          className="secondary small-btn"
          onClick={() => window.print()}
          disabled={!!blocked}
        >
          <Printer size={15} /> Imprimer
        </button>
        <button type="button" className="secondary small-btn" onClick={onClose}>
          <X size={15} /> Fermer
        </button>
      </div>
      {blocked ? (
        <p className="report-sheet report-blocked">{blocked}</p>
      ) : (
        <article className="report-sheet">
          <header>
            <div className="report-brand">OptiLitige · Groupe Cybertek</div>
            <h1>{title}</h1>
            <p>
              {data.period.label.charAt(0).toUpperCase() + data.period.label.slice(1)} · comparé à{' '}
              {data.previous.label}
            </p>
            <p className="report-filters">
              {data.filters.length ? 'Filtres : ' + data.filters.join(' · ') : empty} · Édité le{' '}
              {new Date().toLocaleDateString('fr-FR')}
            </p>
          </header>
          <section className="report-tiles">
            {tiles.map((t) => (
              <div key={t.label}>
                <small>{t.label}</small>
                <b>{t.value}</b>
                <small className={'delta ' + t.delta.tone}>
                  {t.delta.dir === 'up' ? '▲ ' : t.delta.dir === 'down' ? '▼ ' : ''}
                  {t.delta.text}
                </small>
              </div>
            ))}
          </section>
          <section className="report-ranks">
            {ranks.map((r) => (
              <Rank key={r.title} title={r.title} rows={r.rows} total={r.total} />
            ))}
          </section>
          <footer>{note}</footer>
        </article>
      )}
    </div>,
    document.body,
  );
}
