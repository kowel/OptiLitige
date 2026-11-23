'use client';
import { Check, Sparkles } from 'lucide-react';
import { PREFILL_FIELDS } from './prefill.mjs';
import type { Dossier } from './types';

const show = (field: string, v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (/At$|Due$/.test(field) && /^\d{4}-\d{2}-\d{2}/.test(String(v)))
    return String(v).slice(0, 10).split('-').reverse().join('/');
  return String(v);
};

// Fiche : champs du traitement pré-remplis d'après les échanges, à vérifier
export default function PrefillBanner({
  record,
  canEdit,
  busy,
  onConfirm,
}: {
  record: Dossier;
  canEdit: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const p = record.prefilled;
  if (!p?.fields?.length) return null;
  const r = record as unknown as Record<string, unknown>;
  return (
    <div className="prefill-banner" role="note">
      <div className="prefill-head">
        <Sparkles size={16} />
        <b>{p.fields.length} champ(s) pré-rempli(s) d’après les échanges : à vérifier</b>
      </div>
      <ul>
        {p.fields.map((f) => (
          <li key={f}>
            <span>{(PREFILL_FIELDS as Record<string, string>)[f] || f}</span>
            <strong>{show(f, r[f])}</strong>
            {p.sources?.[f] && <small>Source : {p.sources[f]}</small>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <button type="button" className="secondary small-btn" disabled={busy} onClick={onConfirm}>
          <Check size={14} /> C’est vérifié
        </button>
      )}
      <small className="prefill-note">
        Corrigez directement les champs ci-dessous si besoin, puis « Enregistrer le traitement ».
      </small>
    </div>
  );
}
