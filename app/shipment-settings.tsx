'use client';
import { useState } from 'react';
import { Check, PackageCheck } from 'lucide-react';
import { carrierKey } from './carrier-tracking.mjs';
import { dateTime } from './datetime.mjs';

interface ShipmentEntry {
  month: string;
  carrier: string;
  count: number;
}
interface ShipmentSettingsProps {
  shipments: Record<string, Record<string, number>>;
  info?: { source: string; at: string; by?: string } | null;
  carriers: string[];
  busy: boolean;
  onSave: (entries: ShipmentEntry[]) => Promise<unknown>;
}

// Six derniers mois, du plus récent au plus ancien : « 2026-11 », « 2026-10 »…
function lastMonths(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  });
}
const monthLabel = (m: string) =>
  new Date(m + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

// Paramètres → Expéditions : nombre d'expéditions par mois et par transporteur, pour le ratio
// litiges / expéditions. Normalement reçu de l'outil d'expédition (POST /api/shipments) ;
// les responsables peuvent compléter ou corriger à la main.
export default function ShipmentSettings({
  shipments,
  info,
  carriers,
  busy,
  onSave,
}: ShipmentSettingsProps) {
  const months = lastMonths();
  const keys = [...new Set(carriers.map(carrierKey))];
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      months.flatMap((m) =>
        keys.map((c) => [m + '|' + c, shipments?.[m]?.[c] != null ? String(shipments[m][c]) : '']),
      ),
    ),
  );
  const connected = !!info && info.source !== 'Saisie manuelle';
  return (
    <section className="panel settings-panel shipment-settings">
      <div className="integration-icon">
        <PackageCheck size={24} />
      </div>
      <h2>Expéditions par transporteur</h2>
      <span className={'badge ' + (connected ? 'ok' : 'pending')}>
        {connected ? 'Reçues de : ' + info!.source : 'Connexion à l’outil d’expédition à finaliser'}
      </span>
      <p>
        Nombre d’expéditions par mois, pour calculer le ratio litiges / expéditions. Elles
        arriveront automatiquement de votre outil d’expédition ; en attendant, vous pouvez les
        saisir ici.
      </p>
      {info && (
        <p className="muted">
          Dernière mise à jour : {info.source}
          {info.by ? ' (' + info.by + ')' : ''} le {dateTime(info.at)}
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const entries = Object.entries(form)
            .filter(([, v]) => v.trim() !== '')
            .map(([k, v]) => {
              const [month, carrier] = k.split('|');
              return { month, carrier, count: Number(v) };
            });
          await onSave(entries);
        }}
      >
        <div className="table-scroll">
          <table className="shipment-grid">
            <thead>
              <tr>
                <th>Mois</th>
                {keys.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m}>
                  <td>{monthLabel(m)}</td>
                  {keys.map((c) => (
                    <td key={c}>
                      <input
                        aria-label={'Expéditions ' + c + ' ' + monthLabel(m)}
                        type="number"
                        min="0"
                        step="1"
                        value={form[m + '|' + c] ?? ''}
                        onChange={(e) => setForm({ ...form, [m + '|' + c]: e.target.value })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button disabled={busy} className="primary">
          <Check size={16} />
          Enregistrer les expéditions
        </button>
      </form>
    </section>
  );
}
