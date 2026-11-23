'use client';
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

// Déconnexion automatique après 2 heures sans aucune action (clic, frappe, défilement…),
// avec un préavis d'une minute. L'activité est partagée entre les onglets ouverts : une action
// dans l'un garde les autres connectés. L'actualisation automatique de la liste ne compte pas
// comme une action. Seulement dans l'espace réel (pas en démonstration).
export const IDLE_MINUTES = 120;
const WARNING_SECONDS = 60;
const KEY = 'optilitige-derniere-activite';

const readLast = () => {
  try {
    return Number(localStorage.getItem(KEY)) || Date.now();
  } catch {
    return Date.now();
  }
};
const writeLast = (t: number) => {
  try {
    localStorage.setItem(KEY, String(t));
  } catch {
    // navigation privée : l'activité ne vaut que pour cet onglet
  }
};

export default function IdleLogout({
  enabled,
  signOutHref,
  minutes = IDLE_MINUTES,
}: {
  enabled: boolean;
  signOutHref: string;
  minutes?: number;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    writeLast(last);
    const limit = minutes * 60 * 1000;
    // Enregistrement de l'activité, au plus toutes les 5 secondes
    const activity = () => {
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      writeLast(now);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, activity, { passive: true }));
    const check = () => {
      const idle = Date.now() - Math.max(last, readLast());
      if (idle >= limit) {
        window.location.href = signOutHref;
        return;
      }
      const left = Math.ceil((limit - idle) / 1000);
      setSecondsLeft(left <= WARNING_SECONDS ? left : null);
    };
    const timer = window.setInterval(check, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, activity));
      window.clearInterval(timer);
    };
  }, [enabled, minutes, signOutHref]);

  if (secondsLeft === null) return null;
  return (
    <div className="modal-overlay idle-overlay">
      <section className="modal idle-modal" role="alertdialog" aria-label="Déconnexion imminente">
        <span className="integration-icon">
          <Clock />
        </span>
        <h2>Vous allez être déconnecté</h2>
        <p>
          Aucune action depuis près de {minutes} minutes. Par sécurité, vous serez déconnecté dans{' '}
          <b>{secondsLeft} s</b>. Les modifications non enregistrées seront perdues.
        </p>
        <button
          type="button"
          className="primary"
          onClick={() => {
            writeLast(Date.now());
            setSecondsLeft(null);
          }}
        >
          Rester connecté
        </button>
      </section>
    </div>
  );
}
