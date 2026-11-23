'use client';
import { useState } from 'react';
import { Check, Plus, Timer, Trash2 } from 'lucide-react';
import { MAX_SLA_RULES, SLA_KINDS, SLA_STATUSES, splitDuration } from './sla.mjs';
import type { SlaRule } from './types';

// Règle telle qu'affichée dans le formulaire : durée découpée en valeur + unité
type SlaFormRule = Omit<SlaRule, 'hours'> & {
  hours?: number;
  value: number | string;
  unit: string;
};

interface SlaSettingsProps {
  rules: SlaRule[];
  admin: boolean;
  busy: boolean;
  onSave: (sla: SlaRule[]) => Promise<boolean>;
}

// Réglage des délais (SLA) dans Paramètres. Modifiable par les responsables, visible par tous.
export default function SlaSettings({ rules, admin, busy, onSave }: SlaSettingsProps) {
  const toForm = (list: SlaRule[]): SlaFormRule[] =>
    list.map((r) => ({ ...r, ...splitDuration(r.hours), status: r.status || 'Nouveau' }));
  const [items, setItems] = useState<SlaFormRule[]>(toForm(rules));
  const update = (i: number, patch: Partial<SlaFormRule>) =>
    setItems(items.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <section className="panel settings-panel sla-settings">
      <div className="integration-icon">
        <Timer size={24} />
      </div>
      <h2>Délais (SLA)</h2>
      <p>
        Un dossier qui dépasse un délai est signalé « Hors délai » dans la liste, dans son écran et
        sur les tableaux de bord. Délais calendaires (week-ends compris).
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const sla = items.map(({ value, unit, ...r }) => ({
            ...r,
            hours: Number(value) * (unit === 'jours' ? 24 : 1),
            ...(r.kind === 'status' ? {} : { status: undefined }),
          }));
          if (await onSave(sla)) setItems(toForm(sla));
        }}
      >
        {items.length === 0 && <p className="muted">Aucun délai n’est suivi.</p>}
        {items.map((r, i) => (
          <fieldset key={i} className="sla-rule" disabled={!admin}>
            <label className="sla-name">
              Nom
              <input
                required
                maxLength={80}
                value={r.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </label>
            <label>
              Ce qui est mesuré
              <select value={r.kind} onChange={(e) => update(i, { kind: e.target.value })}>
                {Object.entries(SLA_KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v as string}
                  </option>
                ))}
              </select>
            </label>
            {r.kind === 'status' && (
              <label>
                Statut
                <select value={r.status} onChange={(e) => update(i, { status: e.target.value })}>
                  {SLA_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="sla-duration">
              Délai maximum
              <span>
                <input
                  type="number"
                  min={1}
                  max={r.unit === 'jours' ? 365 : 8760}
                  required
                  value={r.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                />
                <select value={r.unit} onChange={(e) => update(i, { unit: e.target.value })}>
                  <option>heures</option>
                  <option>jours</option>
                </select>
              </span>
            </label>
            <label className="sla-enabled">
              <input
                type="checkbox"
                checked={r.enabled !== false}
                onChange={(e) => update(i, { enabled: e.target.checked })}
              />
              Actif
            </label>
            {admin && (
              <button
                type="button"
                className="sla-remove"
                aria-label={'Supprimer le délai ' + r.label}
                title="Supprimer"
                onClick={() => setItems(items.filter((_, k) => k !== i))}
              >
                <Trash2 size={15} />
              </button>
            )}
          </fieldset>
        ))}
        {admin && (
          <div className="sla-actions">
            <button
              type="button"
              className="text-btn"
              disabled={items.length >= MAX_SLA_RULES}
              onClick={() =>
                setItems([
                  ...items,
                  {
                    id: 'delai-' + Date.now().toString(36),
                    label: '',
                    kind: 'status',
                    status: 'En attente RC',
                    value: 2,
                    unit: 'jours',
                    enabled: true,
                  },
                ])
              }
            >
              <Plus size={15} /> Ajouter un délai
            </button>
            <button disabled={busy} className="primary">
              <Check size={16} />
              Enregistrer les délais
            </button>
          </div>
        )}
        {!admin && <small>Seuls les admins peuvent modifier les délais.</small>}
      </form>
    </section>
  );
}
