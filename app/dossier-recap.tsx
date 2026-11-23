'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { stakeOf } from './advanced-filters.mjs';
import { CREDIT_STATUSES, openCredits } from './credit-requests.mjs';
import type { CreditRequest, Dossier } from './types';

// Petit bouton « i » sur chaque ligne de la liste des dossiers : au survol (ou au clavier),
// un récapitulatif du dossier litige, sans l'ouvrir.

const euros = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v || 0);
const day = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) : '—';

export default function DossierRecap({ r, agent }: { r: Dossier; agent: string }) {
  const pending: CreditRequest[] = openCredits(r);
  const issued = (r.credits || []).filter((c) => c.status === 'issued');
  const rows: [string, string][] = [
    ['Client', [r.customer, r.customerAccount].filter(Boolean).join(' · ') || '—'],
    ['Commande', r.order || '—'],
    ['Enseigne', [r.brand, r.store].filter(Boolean).join(' · ') || '—'],
    ['Type', [r.type, r.productType].filter(Boolean).join(' · ') || '—'],
    [
      'Origine',
      r.origin === 'Transport' ? 'Transport · ' + (r.carrier || 'transporteur ?') : r.origin || '—',
    ],
    ['Statut', r.status],
    ['Montant en jeu', euros(stakeOf(r))],
    ['Agent', agent || 'Non attribué'],
    ['Déclaré le', day(r.created)],
  ];
  if (r.clientStage) rows.push(['Étape client', r.clientStage]);
  if (r.origin === 'Transport' && r.carrierStatus) rows.push(['Transporteur', r.carrierStatus]);
  if (pending.length)
    rows.push([
      'Avoir en attente',
      pending
        .map(
          (c) =>
            euros(Number(c.amount)) +
            ' (' +
            (CREDIT_STATUSES as Record<string, string>)[c.status] +
            ')',
        )
        .join(', '),
    ]);
  if (issued.length)
    rows.push([
      'Avoir émis',
      euros(issued.reduce((n, c) => n + Number(c.approvedAmount ?? c.amount ?? 0), 0)),
    ]);
  else if (r.creditIssued && r.credit) rows.push(['Avoir émis', euros(r.credit)]);
  if (r.compensation) rows.push(['Indemnisation', euros(r.compensation)]);
  if (r.status === 'Résolu' && r.outcome) rows.push(['Résultat', r.outcome]);
  // Fiche affichée par-dessus la page (position fixe), à gauche du bouton et toujours dans
  // l'écran : elle n'est plus coupée par le tableau qui défile
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!shown || !button.current || !card.current) return;
    const b = button.current.getBoundingClientRect();
    const c = card.current.getBoundingClientRect();
    const margin = 8;
    const height = document.documentElement.clientHeight;
    const top = Math.max(
      margin,
      Math.min(b.top + b.height / 2 - c.height / 2, height - c.height - margin),
    );
    const left = Math.max(margin, b.left - c.width - 6);
    // Taille d'affichage de l'outil (zoom CSS sur la page) : les mesures sont à l'écran, la
    // position s'écrit avant agrandissement
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    setPos({ top: top / zoom, left: left / zoom });
  }, [shown]);
  const open = () => setShown(true);
  const close = () => {
    setShown(false);
    setPos(null);
  };
  return (
    <span
      className={'dossier-recap' + (shown ? ' open' : '')}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      <button ref={button} type="button" aria-label={'Récapitulatif du dossier ' + r.ref}>
        <Info size={15} />
      </button>
      {shown &&
        createPortal(
          <span
            ref={card}
            className="dossier-recap-card"
            role="tooltip"
            style={pos ? { top: pos.top, left: pos.left } : undefined}
            data-placed={pos ? 'true' : undefined}
          >
            <b>
              {r.ref} · {r.title}
            </b>
            {(r.description || r.descriptionShort) && (
              <p className="dossier-recap-desc">
                <small>Commentaire à la création</small>
                {String(r.description || r.descriptionShort).slice(0, 400)}
              </p>
            )}
            <dl>
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </span>,
          document.body,
        )}
    </span>
  );
}
