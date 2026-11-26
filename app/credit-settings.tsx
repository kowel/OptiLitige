'use client';
import { useState } from 'react';
import { Check, Receipt } from 'lucide-react';
import { CREDIT_FAMILIES } from './credit-requests.mjs';
import type { CreditSettingsData } from './types';

interface CreditSettingsProps {
  settings: CreditSettingsData;
  admin: boolean;
  busy: boolean;
  onSave: (settings: CreditSettingsData) => unknown;
}

// Formulaire : une zone de texte par liste (une valeur par ligne)
interface CreditSettingsForm {
  reasons: Record<string, string>;
  imputations: string;
  managerAbove: Record<string, number | string>;
}

// Paramètres → Avoirs : motifs par famille, imputations et seuils de validation admin.
export default function CreditSettings({ settings, admin, busy, onSave }: CreditSettingsProps) {
  const lines = (list: string[]) => list.join('\n');
  const [f, setF] = useState<CreditSettingsForm>({
    reasons: Object.fromEntries(
      Object.keys(CREDIT_FAMILIES).map((k) => [k, lines(settings.reasons[k] || [])]),
    ),
    imputations: lines(settings.imputations),
    managerAbove: Object.fromEntries(
      Object.keys(CREDIT_FAMILIES).map((k) => [k, settings.managerAbove?.[k] ?? '']),
    ),
  });
  const split = (t: string) =>
    t
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  return (
    <section className="panel settings-panel credit-settings">
      <div className="integration-icon">
        <Receipt size={24} />
      </div>
      <h2>Demandes d’avoir</h2>
      <p>
        Motifs proposés (un par ligne), imputations, et montant au-delà duquel un admin doit
        valider. Laissez le seuil vide pour que le service litige émette seul, quel que soit le
        montant.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            reasons: Object.fromEntries(
              Object.keys(CREDIT_FAMILIES).map((k) => [k, split(f.reasons[k])]),
            ),
            imputations: split(f.imputations),
            managerAbove: f.managerAbove,
          });
        }}
      >
        <div className="credit-settings-grid">
          {Object.entries(CREDIT_FAMILIES).map(([k, label]) => (
            <fieldset key={k} disabled={!admin}>
              <legend>{label as string}</legend>
              <textarea
                rows={6}
                aria-label={'Motifs : ' + label}
                value={f.reasons[k]}
                onChange={(e) => setF({ ...f, reasons: { ...f.reasons, [k]: e.target.value } })}
              />
              <label>
                Validation admin au-delà de (€)
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Jamais"
                  value={f.managerAbove[k]}
                  onChange={(e) =>
                    setF({ ...f, managerAbove: { ...f.managerAbove, [k]: e.target.value } })
                  }
                />
              </label>
            </fieldset>
          ))}
          <fieldset disabled={!admin}>
            <legend>Imputations</legend>
            <textarea
              rows={6}
              aria-label="Imputations"
              value={f.imputations}
              onChange={(e) => setF({ ...f, imputations: e.target.value })}
            />
            <small>Qui porte le coût de l’avoir : information notée sur la demande.</small>
          </fieldset>
        </div>
        {admin ? (
          <button disabled={busy} className="primary">
            <Check size={16} />
            Enregistrer les réglages des avoirs
          </button>
        ) : (
          <small>Seuls les admins peuvent modifier ces réglages.</small>
        )}
      </form>
    </section>
  );
}
