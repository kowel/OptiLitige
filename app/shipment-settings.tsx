'use client';
import { useState } from 'react';
import { Check, DownloadCloud, PackageCheck, RefreshCw } from 'lucide-react';
import { carrierKey } from './carrier-tracking.mjs';
import { dateTime } from './datetime.mjs';
import type { WelcometrackSync } from './types';

interface ShipmentSettingsProps {
  shipments: Record<string, Record<string, number>>;
  info?: { source: string; at: string; by?: string } | null;
  carriers: string[];
  busy: boolean;
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

const count = (n?: number) => (n != null ? n.toLocaleString('fr-FR') : '–');

// Paramètres → Expéditions : nombre d'expéditions par mois et par transporteur, pour le ratio
// litiges / expéditions. Importé de Welcometrack (alerte interne), affiché en lecture seule :
// plus de saisie à la main.
export default function ShipmentSettings({
  shipments,
  info,
  carriers,
  busy,
  welcometrack,
  welcometrackConnected,
  onWelcometrack,
}: ShipmentSettingsProps) {
  const months = lastMonths();
  // Transporteurs de la liste, puis ceux reçus de Welcometrack qui n'y sont pas
  const received = months.flatMap((m) => Object.keys(shipments?.[m] || {}));
  const keys = [...new Set([...carriers.map(carrierKey), ...received])];
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
        Nombre d’expéditions par mois, pour calculer le ratio litiges / expéditions. Ils sont
        importés de Welcometrack (ci-dessous) chaque nuit.
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
                  <td key={c} className="num">
                    {count(shipments?.[m]?.[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
