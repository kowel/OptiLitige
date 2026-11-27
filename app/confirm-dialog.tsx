'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

// Fenêtre de confirmation de l'outil (à la place de la fenêtre du navigateur) : Échap ou un clic
// à côté annule ; « Annuler » a le focus, pour ne pas confirmer par erreur avec Entrée.
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [busy, onCancel]);
  return (
    <div className="modal-overlay" onClick={() => !busy && onCancel()}>
      <section
        className="modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="confirm-icon">
          <TriangleAlert size={22} />
        </span>
        <h2>{title}</h2>
        <div className="confirm-text">{children}</div>
        <div className="confirm-actions">
          <button
            ref={cancel}
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Annuler
          </button>
          <button type="button" className="primary danger-btn" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
