'use client';
import { TRACKING_COLUMNS, trackingRow } from './carrier-tracking.mjs';
import { amountMark } from './advanced-filters.mjs';
import BrandName from './brand-name';
import type { Dossier } from './types';

interface TrackingTableProps {
  records: Dossier[];
  onOpen: (record: Dossier) => void;
  /** Seuils des contours orangé / rouge (Paramètres → Repères de montant) */
  amountAlerts?: { orange: number; red: number };
}

const euros = (v: number | null) =>
  v === null || v === undefined
    ? ''
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
const fr = (d: string) => (d ? d.split('-').reverse().join('/') : '');

// Couleur des statuts, comme dans l'ancien tableau Excel
const tone = (v: string) =>
  ['Terminé', 'Accepté'].includes(v)
    ? 'ok'
    : v === 'Refusé'
      ? 'ko'
      : ['En cours', 'Partiel', 'À transmettre'].includes(v)
        ? 'wait'
        : '';

// Vue « Suivi de bout en bout » de la liste des dossiers : une ligne par dossier avec le côté
// client et le côté transporteur (colonnes du fichier Excel de suivi 2025).
export default function TrackingTable({ records, onOpen, amountAlerts }: TrackingTableProps) {
  return (
    <table className="tracking-table">
      <thead>
        <tr>
          {TRACKING_COLUMNS.map(([k, l]) => (
            <th key={k}>{l}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {records.map((r) => {
          const row = trackingRow(r) as Record<string, string | number | boolean | null>;
          return (
            <tr
              key={r.id}
              data-record-id={r.id}
              {...amountMark(r, amountAlerts)}
              onClick={() => onOpen(r)}
            >
              {TRACKING_COLUMNS.map(([k]) => {
                const v = row[k];
                let content: React.ReactNode = v as string;
                if (['disputeValue', 'compensation', 'gap'].includes(k))
                  content = euros(v as number | null);
                else if (k === 'created' || k === 'creditDate') content = fr(v as string);
                else if (k === 'anticipated') content = v ? 'Oui' : '';
                else if (k === 'brand') content = <BrandName brand={r.brand} store={r.store} />;
                else if (k === 'clientSide' || k === 'carrierSide')
                  content = <span className={'track-pill ' + tone(String(v))}>{v as string}</span>;
                return (
                  <td
                    key={k}
                    className={
                      k === 'gap' && typeof v === 'number' && v > 0
                        ? 'gap-open'
                        : k === 'anticipated' && v
                          ? 'anticipated'
                          : ''
                    }
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
