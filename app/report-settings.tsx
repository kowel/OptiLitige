'use client';
import { useState } from 'react';
import { Check, Eye, FileBarChart, Plus, Trash2 } from 'lucide-react';
import { EMPTY_ANALYTICS } from './analytics-filters.mjs';
import { FREQUENCIES, REPORT_ROLES } from './reports.mjs';
import type { AnalyticsOptions } from './analytics-filter-bar';

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'monthly' | 'weekly';
  filters: typeof EMPTY_ANALYTICS;
  recipients: { emails: string[]; roles: string[] };
  active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  RC: 'Relation client',
  SAV: 'SAV',
  'Service Litige': 'Service Litige',
  Responsable: 'Responsable',
  Admin: 'Admin',
};

// Paramètres → Rapports programmés (responsables) : rapports ciblés, rythme, destinataires
export default function ReportSettings({
  reports,
  options,
  busy,
  onSave,
  onPreview,
}: {
  reports: ScheduledReport[];
  options: AnalyticsOptions;
  busy: boolean;
  onSave: (reports: ScheduledReport[]) => Promise<unknown>;
  onPreview: (report: ScheduledReport) => void;
}) {
  const [draft, setDraft] = useState<ScheduledReport[]>(() =>
    reports.map((r) => structuredClone(r)),
  );
  const set = (i: number, patch: Partial<ScheduledReport>) =>
    setDraft(draft.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setFilter = (i: number, k: keyof typeof EMPTY_ANALYTICS, v: string) =>
    set(i, { filters: { ...draft[i].filters, [k]: v } });
  const toggle = (list: string[], v: string, on: boolean) =>
    on ? [...new Set([...list, v])] : list.filter((x) => x !== v);
  const select = (i: number, k: keyof typeof EMPTY_ANALYTICS, label: string, items: string[]) => (
    <label>
      {label}
      <select value={draft[i].filters[k]} onChange={(e) => setFilter(i, k, e.target.value)}>
        <option value="">Tous</option>
        {items.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="panel settings-panel report-settings">
      <div className="integration-icon">
        <FileBarChart size={24} />
      </div>
      <h2>Rapports programmés</h2>
      <p>
        Créez des rapports ciblés (par enseigne, transporteur, type…), mensuels ou hebdomadaires,
        pour les personnes ou les services de votre choix. À la fin de chaque période, le rapport
        arrive aux destinataires dans la cloche (onglet « Rapports »), prêt à imprimer en PDF.
        L’envoi par e-mail s’ajoutera avec la connexion Microsoft 365.
      </p>
      {draft.map((r, i) => (
        <fieldset key={r.id} className={'report-def' + (r.active ? '' : ' paused')}>
          <div className="report-def-head">
            <input
              className="report-name"
              aria-label="Nom du rapport"
              placeholder="Nom du rapport (ex. Transport GROSBILL — direction)"
              value={r.name}
              onChange={(e) => set(i, { name: e.target.value })}
            />
            <select
              aria-label="Rythme"
              value={r.frequency}
              onChange={(e) =>
                set(i, { frequency: e.target.value as ScheduledReport['frequency'] })
              }
            >
              {Object.entries(FREQUENCIES).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={r.active}
                onChange={(e) => set(i, { active: e.target.checked })}
              />
              Actif
            </label>
          </div>
          <div className="report-def-filters">
            {select(i, 'brand', 'Enseigne', options.brands)}
            {select(i, 'carrier', 'Transporteur', options.carriers)}
            {select(i, 'type', 'Type de litige', options.types)}
            {select(i, 'productType', 'Type de produit', options.products)}
            {select(i, 'store', 'Magasin', options.stores)}
            {select(i, 'origin', 'Origine', ['Transport', 'Interne'])}
          </div>
          <div className="report-def-recipients">
            <b>Destinataires</b>
            <div>
              {REPORT_ROLES.map((role) => (
                <label key={role} className="inline-check">
                  <input
                    type="checkbox"
                    checked={r.recipients.roles.includes(role)}
                    onChange={(e) =>
                      set(i, {
                        recipients: {
                          ...r.recipients,
                          roles: toggle(r.recipients.roles, role, e.target.checked),
                        },
                      })
                    }
                  />
                  Tout le service {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
            <div className="report-people">
              {options.members.map((m) => (
                <label key={m.email} className="inline-check">
                  <input
                    type="checkbox"
                    checked={r.recipients.emails.includes(m.email)}
                    onChange={(e) =>
                      set(i, {
                        recipients: {
                          ...r.recipients,
                          emails: toggle(r.recipients.emails, m.email, e.target.checked),
                        },
                      })
                    }
                  />
                  {m.name || m.email}
                </label>
              ))}
            </div>
          </div>
          <div className="report-def-actions">
            <button type="button" className="secondary small-btn" onClick={() => onPreview(r)}>
              <Eye size={14} /> Aperçu (dernière période)
            </button>
            <button
              type="button"
              className="text-btn danger"
              onClick={() => setDraft(draft.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} /> Supprimer
            </button>
          </div>
        </fieldset>
      ))}
      <div className="claim-actions">
        <button
          type="button"
          className="secondary small-btn"
          onClick={() =>
            setDraft([
              ...draft,
              {
                id: 'rapport-' + Date.now().toString(36),
                name: '',
                frequency: 'monthly',
                filters: { ...EMPTY_ANALYTICS },
                recipients: { emails: [], roles: ['Admin'] },
                active: true,
              },
            ])
          }
        >
          <Plus size={14} /> Nouveau rapport
        </button>
        <span className="spacer" />
        <button type="button" className="primary" disabled={busy} onClick={() => onSave(draft)}>
          <Check size={16} /> Enregistrer les rapports
        </button>
      </div>
    </section>
  );
}
