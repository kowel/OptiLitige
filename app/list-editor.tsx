'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Lock, Plus, Trash2 } from 'lucide-react';

interface Row {
  // Valeur enregistrée au départ (null = ajoutée dans ce formulaire)
  original: string | null;
  value: string;
  color?: string;
}

export interface ListSave {
  values: string[];
  renames: { from: string; to: string }[];
  applyToRecords: boolean;
  colors?: Record<string, string>;
}

interface ListEditorProps {
  title: string;
  help: string;
  values: string[];
  /** Valeurs utilisées par l'outil : ni renommées ni supprimées */
  locked?: string[];
  /** Couleurs par valeur (enseignes) : affiche un sélecteur de couleur */
  colors?: Record<string, string>;
  /** Nombre de dossiers par valeur, pour prévenir avant une suppression */
  usage?: Record<string, number>;
  /** Ce que compte `usage` et ce qui garde l'ancienne valeur (Paramètres → Contentieux) */
  usageUnit?: string;
  recordsName?: string;
  busy: boolean;
  onSave: (save: ListSave) => Promise<boolean>;
}

// Éditeur d'une liste des Paramètres : ajouter, renommer, déplacer, supprimer une valeur.
// Un renommage peut s'appliquer aussi aux anciens dossiers (sinon ils gardent l'ancien nom).
export default function ListEditor({
  title,
  help,
  values,
  locked = [],
  colors,
  usage = {},
  usageUnit = 'dossier(s)',
  recordsName = 'anciens dossiers',
  busy,
  onSave,
}: ListEditorProps) {
  const start = () => values.map((v) => ({ original: v, value: v, color: colors?.[v] }) as Row);
  const [rows, setRows] = useState<Row[]>(start);
  const [added, setAdded] = useState('');
  const [applyToRecords, setApply] = useState(true);
  const renames = rows.filter((r) => r.original && r.value.trim() && r.value.trim() !== r.original);
  const removed = values.filter((v) => !rows.some((r) => r.original === v));
  const dirty =
    renames.length > 0 ||
    removed.length > 0 ||
    rows.length !== values.length ||
    rows.some(
      (r, i) => r.original !== values[i] || (colors && r.color !== colors[r.original || '']),
    );
  const set = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };
  const add = () => {
    const v = added.trim();
    if (!v || rows.some((r) => r.value.trim().toLowerCase() === v.toLowerCase())) return;
    setRows([...rows, { original: null, value: v, color: colors ? '#8b8c9b' : undefined }]);
    setAdded('');
  };

  return (
    <section className="panel settings-panel list-editor">
      <h3>{title}</h3>
      <p>{help}</p>
      <ul>
        {rows.map((r, i) => {
          const isLocked = !!r.original && locked.includes(r.original);
          return (
            <li key={(r.original ?? 'new') + i}>
              {colors && (
                <input
                  type="color"
                  aria-label={'Couleur de ' + r.value}
                  value={r.color || '#8b8c9b'}
                  onChange={(e) => set(i, { color: e.target.value })}
                />
              )}
              <input
                aria-label={'Nom : ' + r.value}
                value={r.value}
                disabled={isLocked}
                maxLength={120}
                onChange={(e) => set(i, { value: e.target.value })}
                style={colors ? { color: r.color } : undefined}
              />
              {isLocked && (
                <span className="list-lock" title="Utilisé par l’outil : ni renommé ni supprimé">
                  <Lock size={13} />
                </span>
              )}
              {!!r.original && usage[r.original] > 0 && (
                <small className="list-usage">
                  {usage[r.original]} {usageUnit}
                </small>
              )}
              <button
                type="button"
                aria-label={'Monter ' + r.value}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                aria-label={'Descendre ' + r.value}
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                aria-label={'Supprimer ' + r.value}
                disabled={isLocked}
                onClick={() => setRows(rows.filter((_, k) => k !== i))}
              >
                <Trash2 size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="list-add">
        <input
          aria-label={'Ajouter à ' + title}
          placeholder="Nouvelle valeur…"
          value={added}
          maxLength={120}
          onChange={(e) => setAdded(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="secondary" onClick={add} disabled={!added.trim()}>
          <Plus size={15} /> Ajouter
        </button>
      </div>
      {removed.length > 0 && (
        <p className="list-note">
          Retiré(s) de la liste : {removed.join(', ')}. Les {recordsName} gardent leur valeur.
        </p>
      )}
      {renames.length > 0 && (
        <label className="list-apply">
          <input
            type="checkbox"
            checked={applyToRecords}
            onChange={(e) => setApply(e.target.checked)}
          />
          Renommer aussi dans les {recordsName} (
          {renames.map((r) => '« ' + r.original + ' » → « ' + r.value.trim() + ' »').join(', ')})
        </label>
      )}
      <button
        type="button"
        className="primary"
        disabled={busy || !dirty}
        onClick={async () => {
          const values = rows.map((r) => r.value.trim()).filter(Boolean);
          const ok = await onSave({
            values,
            renames: renames.map((r) => ({ from: r.original!, to: r.value.trim() })),
            applyToRecords,
            colors: colors
              ? Object.fromEntries(
                  rows.filter((r) => r.color).map((r) => [r.value.trim(), r.color!]),
                )
              : undefined,
          });
          if (ok)
            setRows(rows.map((r) => ({ ...r, original: r.value.trim(), value: r.value.trim() })));
        }}
      >
        <Check size={16} /> Enregistrer
      </button>
    </section>
  );
}
