'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

// Fenêtre de confirmation de l'outil (à la place de la fenêtre du navigateur) : Échap ou un clic
// à côté annule ; « Annuler » a le focus, pour ne pas confirmer par erreur avec Entrée.
// danger (par défaut) : icône d'alerte et bouton rouge ; sinon, bouton principal du thème.
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Annuler',
  danger = true,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [busy, onCancel]);
  return (
    <div className="modal-overlay" onClick={() => !busy && onCancel()}>
      <section
        className={'modal confirm-modal' + (danger ? ' danger' : '')}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="confirm-icon">
          {danger ? <TriangleAlert size={22} /> : <RotateCcw size={22} />}
        </span>
        <h2>{title}</h2>
        {children && <div className="confirm-text">{children}</div>}
        <div className="confirm-actions">
          <button
            ref={cancel}
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={'primary' + (danger ? ' danger-btn' : '')}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

type Ask = {
  title: string;
  text?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
};

// Remplace window.confirm : `if (await ask({...})) …` ; afficher {dialog} dans le composant.
export function useConfirm() {
  const [pending, setPending] = useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = useCallback(
    (a: Ask) => new Promise<boolean>((resolve) => setPending({ ...a, resolve })),
    [],
  );
  const close = useCallback(
    (ok: boolean) =>
      setPending((p) => {
        p?.resolve(ok);
        return null;
      }),
    [],
  );
  const cancel = useCallback(() => close(false), [close]);
  const dialog = pending ? (
    <ConfirmDialog
      title={pending.title}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      danger={pending.danger}
      onConfirm={() => close(true)}
      onCancel={cancel}
    >
      {pending.text}
    </ConfirmDialog>
  ) : null;
  return { ask, dialog };
}
