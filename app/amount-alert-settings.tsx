'use client';
import { useState } from 'react';
import { BadgeEuro, Check } from 'lucide-react';

interface AmountAlertSettingsProps {
  alerts: { orange: number; red: number };
  busy: boolean;
  onSave: (alerts: { orange: number; red: number }) => Promise<unknown>;
}

// Paramètres → Repères de montant : seuils des contours orangé et rouge dans la liste des
// dossiers (montant de commande). Réservé aux responsables, comme toute la page Paramètres.
export default function AmountAlertSettings({ alerts, busy, onSave }: AmountAlertSettingsProps) {
  const [orange, setOrange] = useState(String(alerts.orange || ''));
  const [red, setRed] = useState(String(alerts.red || ''));
  return (
    <section className="panel settings-panel amount-alert-settings">
      <div className="integration-icon">
        <BadgeEuro size={24} />
      </div>
      <h2>Repères de montant</h2>
      <p>
        Dans la liste des dossiers, les dossiers dont le montant de commande atteint ces seuils sont
        entourés de couleur. Laissez vide ou mettez 0 pour désactiver un repère.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave({ orange: Number(orange || 0), red: Number(red || 0) });
        }}
      >
        <label>
          <span className="amount-swatch orange" /> Contour orangé à partir de (€)
          <input
            type="number"
            min="0"
            step="1"
            value={orange}
            onChange={(e) => setOrange(e.target.value)}
          />
        </label>
        <label>
          <span className="amount-swatch red" /> Contour rouge à partir de (€)
          <input
            type="number"
            min="0"
            step="1"
            value={red}
            onChange={(e) => setRed(e.target.value)}
          />
        </label>
        <button disabled={busy} className="primary">
          <Check size={16} />
          Enregistrer les repères
        </button>
      </form>
    </section>
  );
}
