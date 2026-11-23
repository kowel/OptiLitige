'use client';
import { useState } from 'react';
import { CalendarClock, Check } from 'lucide-react';

// Paramètres → Relances transporteur (responsables) : délais utilisés pour remplir seules la
// prochaine relance et la réponse attendue, à partir de la date de transmission
export default function CarrierDelaySettings({
  delays,
  busy,
  onSave,
}: {
  delays: { followupDays: number; responseDays: number };
  busy: boolean;
  onSave: (d: { followupDays: number; responseDays: number }) => Promise<unknown>;
}) {
  const [followup, setFollowup] = useState(String(delays.followupDays));
  const [response, setResponse] = useState(String(delays.responseDays));
  return (
    <section className="panel settings-panel carrier-delay-settings">
      <div className="integration-icon">
        <CalendarClock size={24} />
      </div>
      <h2>Relances transporteur</h2>
      <p>
        Quand le Service Litige saisit la date de transmission au transporteur, la prochaine relance
        et la réponse attendue se remplissent seules (modifiables ensuite). Chaque « Relance faite »
        repousse la prochaine relance du même délai.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave({ followupDays: Number(followup), responseDays: Number(response) });
        }}
      >
        <label>
          Relance tous les (jours)
          <input
            type="number"
            min="1"
            max="90"
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
          />
        </label>
        <label>
          Réponse attendue après (jours)
          <input
            type="number"
            min="1"
            max="180"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
        </label>
        <button disabled={busy} className="primary">
          <Check size={16} />
          Enregistrer les délais
        </button>
      </form>
    </section>
  );
}
