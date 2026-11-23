'use client';
import { useEffect, useRef } from 'react';
import type { Comment } from './types';

// Échanges en direct dans le dossier ouvert : les commentaires sont relus toutes les 5 secondes,
// seulement par l'onglet visible. Ce qu'un onglet reçoit (ou envoie) est partagé aussitôt avec
// les autres onglets du même navigateur (BroadcastChannel) : pas de requêtes en double, et un
// commentaire écrit dans un onglet apparaît tout de suite dans les autres. Seuls les commentaires
// sont mis à jour : le formulaire de traitement et le message en cours d'écriture ne bougent pas.

export const LIVE_INTERVAL_MS = 5000;
const CHANNEL = 'optilitige-commentaires';

const channel = () => {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
};

// Même liste de commentaires (mêmes identifiants, même texte, même ordre) ?
export function sameComments(a: Comment[] = [], b: Comment[] = []) {
  return a.length === b.length && a.every((c, i) => c.id === b[i].id && c.text === b[i].text);
}

// Prévenir les autres onglets (après l'envoi d'un commentaire, par exemple)
export function shareComments(id: string, comments: Comment[]) {
  const c = channel();
  if (!c) return;
  c.postMessage({ id, comments });
  c.close();
}

export function useLiveComments(
  id: string | null,
  apply: (id: string, comments: Comment[]) => void,
  intervalMs = LIVE_INTERVAL_MS,
) {
  // Toujours la dernière version de `apply` (elle lit l'état courant de la page)
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => {
    if (!id) return;
    let stopped = false,
      running = false;
    const bc = channel();
    if (bc)
      bc.onmessage = (e: MessageEvent) => {
        if (!stopped && e.data?.id === id && Array.isArray(e.data.comments))
          applyRef.current(id, e.data.comments);
      };
    const poll = async () => {
      // Onglet caché : rien (il se met à jour en revenant au premier plan)
      if (stopped || running || document.hidden) return;
      running = true;
      try {
        const res = await fetch('/api/data?part=comments&id=' + encodeURIComponent(id), {
          cache: 'no-store',
        });
        if (!res.ok || stopped) return;
        const d = (await res.json()) as { comments?: Comment[] };
        if (stopped || !Array.isArray(d.comments)) return;
        applyRef.current(id, d.comments);
        bc?.postMessage({ id, comments: d.comments });
      } catch {
        // réseau coupé : nouvel essai au prochain passage
      } finally {
        running = false;
      }
    };
    const timer = window.setInterval(poll, intervalMs);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      bc?.close();
    };
  }, [id, intervalMs]);
}
