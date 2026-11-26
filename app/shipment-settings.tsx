'use client';
import { useState } from 'react';
import { Check, DownloadCloud, PackageCheck, RefreshCw } from 'lucide-react';
import { carrierKey } from './carrier-tracking.mjs';
import { dateTime } from './datetime.mjs';
import type { WelcometrackSync } from './types';

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
  /** Import depuis l'alerte interne Welcometrack (lecture seule) */
  welcometrack?: WelcometrackSync;
  welcometrackConnected: boolean;
  onWelcometrack: (body: { action: string; alertId?: string }) => Promise<unknown>;
}

// Welcometrack : n° de l'alerte interne qui liste les expéditions, import à la demande (et
// chaque nuit). L'outil ne fait que lire l'alerte (GET /alerts/get).
function WelcometrackImport({
  state,
  connected,
  busy,
  onAction,
}: {
  state?: WelcometrackSync;
  connected: boolean;
  busy: boolean;
  onAction: ShipmentSettingsProps['onWelcometrack'];
}) {
  const [alertId, setAlertId] = useState(state?.alertId || '');
  const saved = state?.alertId || '';
  return (
    <div className="welcometrack-import">
      <h3>
        <DownloadCloud size={17} /> Depuis Welcometrack
        <span className={'carrier-api-state ' + (connected && saved ? 'on' : 'off')}>
          {connected && saved ? 'Import chaque nuit' : 'À régler'}
        </span>
      </h3>
      <p className="muted">
        Dans Welcometrack, créez une alerte interne qui liste les expéditions des derniers mois,
        avec au moins les colonnes <b>transporteur</b> et <b>date d’expédition</b>, puis indiquez
        son numéro ici. OptiLitige la lit chaque nuit (lecture seule) et compte les expéditions par
        mois et par transporteur.
        {!connected &&
          ' La clé Welcometrack se règle dans Paramètres → Transporteurs → API de suivi des colis.'}
      </p>
      <form
        className="welcometrack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await onAction({ action: 'welcometrack-alert', alertId: alertId.trim() });
        }}
      >
        <label>
          N° de l’alerte interne
          <input
            inputMode="numeric"
            maxLength={12}
            value={alertId}
            onChange={(e) => setAlertId(e.target.value)}
          />
        </label>
        <button className="secondary" disabled={busy || alertId.trim() === saved}>
          <Check size={16} /> Enregistrer
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || !connected || !saved}
          onClick={() => onAction({ action: 'welcometrack-sync' })}
        >
          <RefreshCw size={16} className={busy ? 'spin' : ''} /> Importer maintenant
        </button>
      </form>
      {state?.at && (
        <p className={'carrier-api-note ' + (state.ok ? 'ok' : 'error')} role="status">
          {dateTime(state.at)} ({state.by || 'import'}) : {state.message}
        </p>
      )}
    </div>
  );
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
  welcometrack,
  welcometrackConnected,
  onWelcometrack,
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
        {connected ? 'Reçues de : ' + info!.source : 'Import Welcometrack à régler'}
      </span>
      <p>
        Nombre d’expéditions par mois, pour calculer le ratio litiges / expéditions. Ils arrivent de
        Welcometrack (ci-dessous) ; vous pouvez aussi les saisir ou les corriger à la main.
      </p>
      <WelcometrackImport
        key={welcometrack?.alertId || ''}
        state={welcometrack}
        connected={welcometrackConnected}
        busy={busy}
        onAction={onWelcometrack}
      />
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
