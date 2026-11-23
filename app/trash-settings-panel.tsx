'use client';
import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { TRASH_DAYS_CHOICES } from './trash-settings.mjs';

export interface TrashSettings {
  autoPurge: boolean;
  days: number;
}

interface TrashSettingsPanelProps {
  settings: TrashSettings;
  admin: boolean;
  busy: boolean;
  onSave: (settings: TrashSettings) => Promise<boolean>;
}

// Paramètres → Corbeille des pièces jointes : par défaut, aucune pièce supprimée n'est effacée.
// Un admin peut choisir de vider la corbeille automatiquement après un délai.
export default function TrashSettingsPanel({
  settings,
  admin,
  busy,
  onSave,
}: TrashSettingsPanelProps) {
  const [value, setValue] = useState<TrashSettings>({ ...settings });
  return (
    <section className="panel settings-panel trash-settings">
      <div className="integration-icon">
        <Trash2 size={24} />
      </div>
      <h2>Corbeille des pièces jointes</h2>
      <p>
        Une pièce jointe supprimée d’un dossier ou d’un contentieux est rangée dans la corbeille du
        stockage : elle reste récupérable. Par défaut, rien n’est jamais effacé.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(value);
        }}
      >
        <fieldset disabled={!admin}>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={value.autoPurge}
              onChange={(e) => setValue({ ...value, autoPurge: e.target.checked })}
            />
            Vider automatiquement la corbeille
          </label>
          <label>
            Effacer les pièces supprimées depuis plus de
            <select
              value={value.days}
              disabled={!value.autoPurge}
              onChange={(e) => setValue({ ...value, days: Number(e.target.value) })}
            >
              {TRASH_DAYS_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {d} jours
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        {value.autoPurge && (
          <p className="muted">
            Chaque nuit, les pièces supprimées depuis plus de {value.days} jours sont effacées
            définitivement.
          </p>
        )}
        {admin ? (
          <div className="claim-actions">
            <button className="primary small-btn" disabled={busy}>
              <Check size={14} /> Enregistrer
            </button>
          </div>
        ) : (
          <p className="muted">Réservé aux admins.</p>
        )}
      </form>
    </section>
  );
}
