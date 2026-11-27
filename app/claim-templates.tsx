'use client';
import { useState } from 'react';
import { useConfirm } from './confirm-dialog';
import { Check, Plus, RotateCcw, Settings2, Trash2 } from 'lucide-react';
import { DEFAULT_CLAIM_TEMPLATES, PLACEHOLDERS } from './claim-templates.mjs';

export interface ClaimTemplate {
  id: string;
  title: string;
  keywords: string[];
  subject: string;
  body: string;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Gestion des modèles de réclamation (Service Litige, Responsable, Admin). Le choix du modèle
// se fait dans le cadre « Écrire un e-mail » de l'onglet Transporteur (transport-conversation).
export function TemplateEditor({
  templates,
  busy,
  onCancel,
  onSave,
}: {
  templates: ClaimTemplate[];
  busy: boolean;
  onCancel: () => void;
  onSave: (t: ClaimTemplate[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ClaimTemplate[]>(() => templates.map((t) => ({ ...t })));
  const [open, setOpen] = useState(0);
  const { ask, dialog } = useConfirm();
  const set = (i: number, patch: Partial<ClaimTemplate>) =>
    setDraft(draft.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <section className="claim-templates claim-editor" aria-label="Gérer les modèles de réclamation">
      {dialog}
      <div className="claim-head">
        <span className="carrier-platform-icon">
          <Settings2 size={18} />
        </span>
        <div>
          <strong>Gérer les modèles de réclamation</strong>
          <small>
            Champs remplis automatiquement :{' '}
            {Object.keys(PLACEHOLDERS)
              .map((k) => '{' + k + '}')
              .join(' ')}
          </small>
        </div>
      </div>
      {draft.map((t, i) => (
        <details key={i} open={open === i} className="claim-edit-item">
          <summary
            onClick={(e) => {
              e.preventDefault();
              setOpen(open === i ? -1 : i);
            }}
          >
            {t.title || 'Nouveau modèle'}
          </summary>
          <label>
            Titre
            <input value={t.title} onChange={(e) => set(i, { title: e.target.value })} />
          </label>
          <label>
            Proposé pour les types de litige contenant (mots séparés par des virgules)
            <input
              value={t.keywords.join(', ')}
              onChange={(e) => set(i, { keywords: e.target.value.split(',').map((k) => k.trim()) })}
            />
          </label>
          <label>
            Objet
            <input value={t.subject} onChange={(e) => set(i, { subject: e.target.value })} />
          </label>
          <label>
            Message
            <textarea rows={10} value={t.body} onChange={(e) => set(i, { body: e.target.value })} />
          </label>
          <button
            type="button"
            className="text-btn danger"
            onClick={() => setDraft(draft.filter((_, j) => j !== i))}
          >
            <Trash2 size={14} /> Supprimer ce modèle
          </button>
        </details>
      ))}
      <div className="claim-actions">
        <button
          type="button"
          className="secondary small-btn"
          onClick={() => {
            setDraft([
              ...draft,
              { id: 'modele-' + Date.now(), title: '', keywords: [], subject: '', body: '' },
            ]);
            setOpen(draft.length);
          }}
        >
          <Plus size={14} /> Ajouter un modèle
        </button>
        <button
          type="button"
          className="text-btn"
          onClick={async () => {
            if (
              await ask({
                title: 'Revenir aux modèles d’origine ?',
                text: (
                  <p>
                    Tous les modèles seront remplacés par ceux proposés au départ (rien n’est
                    enregistré tant que vous ne validez pas).
                  </p>
                ),
                confirmLabel: 'Remplacer les modèles',
                danger: false,
              })
            )
              setDraft((DEFAULT_CLAIM_TEMPLATES as ClaimTemplate[]).map((t) => ({ ...t })));
          }}
        >
          <RotateCcw size={14} /> Modèles d’origine
        </button>
        <span className="spacer" />
        <button type="button" className="text-btn" onClick={onCancel}>
          Annuler
        </button>
        <button
          type="button"
          className="primary small-btn"
          disabled={busy}
          onClick={() => onSave(draft.map((t) => ({ ...t, keywords: t.keywords.filter(Boolean) })))}
        >
          <Check size={14} /> Enregistrer les modèles
        </button>
      </div>
    </section>
  );
}
