'use client';
import { useState } from 'react';
import { ArrowUpRight, Bell, BellOff, UserPlus, X, Workflow } from 'lucide-react';
import { BULK_STATUSES } from './bulk-actions.mjs';

// Barre des actions groupées, affichée quand des dossiers sont cochés dans la liste
export default function BulkBar({
  count,
  canEdit,
  agents,
  busy,
  onAssign,
  onStatus,
  onWatch,
  onExport,
  onClear,
}: {
  count: number;
  canEdit: boolean;
  agents: { email: string; name: string }[];
  busy: boolean;
  onAssign: (email: string) => void;
  onStatus: (status: string) => void;
  onWatch: (on: boolean) => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const [agent, setAgent] = useState('');
  const [status, setStatus] = useState('');
  return (
    <div className="bulk-bar" role="toolbar" aria-label="Actions groupées">
      <b>{count} dossier(s) sélectionné(s)</b>
      {canEdit && (
        <span className="bulk-group">
          <UserPlus size={14} />
          <select aria-label="Attribuer à" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">Attribuer à…</option>
            <option value="-">Personne (retirer l’attribution)</option>
            {agents.map((a) => (
              <option key={a.email} value={a.email}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary small-btn"
            disabled={busy || !agent}
            onClick={() => {
              onAssign(agent === '-' ? '' : agent);
              setAgent('');
            }}
          >
            Attribuer
          </button>
        </span>
      )}
      {canEdit && (
        <span className="bulk-group">
          <Workflow size={14} />
          <select
            aria-label="Changer le statut"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Passer en…</option>
            {BULK_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            className="secondary small-btn"
            disabled={busy || !status}
            onClick={() => {
              onStatus(status);
              setStatus('');
            }}
          >
            Appliquer
          </button>
        </span>
      )}
      <button
        type="button"
        className="secondary small-btn"
        disabled={busy}
        onClick={() => onWatch(true)}
      >
        <Bell size={14} /> Suivre
      </button>
      <button
        type="button"
        className="secondary small-btn"
        disabled={busy}
        onClick={() => onWatch(false)}
      >
        <BellOff size={14} /> Ne plus suivre
      </button>
      <button type="button" className="secondary small-btn" onClick={onExport}>
        <ArrowUpRight size={14} /> Exporter
      </button>
      <button type="button" className="text-btn" onClick={onClear}>
        <X size={14} /> Désélectionner
      </button>
    </div>
  );
}
