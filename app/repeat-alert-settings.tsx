'use client';
import { useState } from 'react';
import { Check, ShieldAlert } from 'lucide-react';

interface RepeatAlerts {
  count: number;
  months: number;
  fraud: boolean;
}

// Paramètres → Alerte client récidiviste (responsables)
export default function RepeatAlertSettings({
  alerts,
  busy,
  onSave,
}: {
  alerts: RepeatAlerts;
  busy: boolean;
  onSave: (alerts: RepeatAlerts) => Promise<unknown>;
}) {
  const [count, setCount] = useState(String(alerts.count));
  const [months, setMonths] = useState(String(alerts.months));
  const [fraud, setFraud] = useState(alerts.fraud);
  return (
    <section className="panel settings-panel repeat-alert-settings">
      <div className="integration-icon">
        <ShieldAlert size={24} />
      </div>
      <h2>Alerte client récidiviste</h2>
      <p>
        À la création d’un litige et dans la fiche, un bandeau signale un client qui a déjà eu
        plusieurs litiges ou un litige classé fraude. Le client est reconnu par son nom (sans tenir
        compte des accents, majuscules ni de l’ordre prénom / nom).
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave({ count: Number(count || 0), months: Number(months || 12), fraud });
        }}
      >
        <label>
          À partir de (litiges, dossier en cours compris ; 0 = désactivé)
          <input
            type="number"
            min="0"
            max="50"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </label>
        <label>
          Sur une période de (mois)
          <input
            type="number"
            min="1"
            max="60"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={fraud} onChange={(e) => setFraud(e.target.checked)} />
          Toujours alerter si un litige du client a été classé « fraude »
        </label>
        <button disabled={busy} className="primary">
          <Check size={16} />
          Enregistrer l’alerte
        </button>
      </form>
    </section>
  );
}
