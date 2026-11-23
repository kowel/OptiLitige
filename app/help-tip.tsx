'use client';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { ChevronUp, CircleHelp } from 'lucide-react';

// Petites aides repliables : chacune se masque ou s'ouvre, et le choix est retenu dans le
// navigateur (même aide, même choix dans tous les onglets). Affichées par défaut.
const PREFIX = 'optilitige-aide:';
const EVENT = 'optilitige-aide';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENT, callback);
  };
}
const read = (id: string) => {
  try {
    return localStorage.getItem(PREFIX + id) !== 'masquee';
  } catch {
    return true;
  }
};
export function setHelpOpen(id: string, open: boolean) {
  try {
    if (open) localStorage.removeItem(PREFIX + id);
    else localStorage.setItem(PREFIX + id, 'masquee');
  } catch {
    // navigation privée : le choix vaut pour cet affichage seulement
  }
  window.dispatchEvent(new Event(EVENT));
}
// Aide ouverte ? (ouverte côté serveur, puis selon le choix enregistré)
export function useHelpOpen(id: string) {
  return useSyncExternalStore(
    subscribe,
    () => read(id),
    () => true,
  );
}

export default function HelpTip({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const open = useHelpOpen(id);
  if (!open)
    return (
      <button
        type="button"
        className="help-tip-closed"
        onClick={() => setHelpOpen(id, true)}
        title={'Ouvrir l’aide : ' + title}
      >
        <CircleHelp size={13} /> Ouvrir l’aide
      </button>
    );
  return (
    <aside className="help-tip" aria-label={'Aide : ' + title}>
      <CircleHelp size={16} />
      <div>
        <b>{title}</b>
        <div className="help-tip-body">{children}</div>
      </div>
      <button type="button" className="text-btn" onClick={() => setHelpOpen(id, false)}>
        <ChevronUp size={14} /> Masquer l’aide
      </button>
    </aside>
  );
}
