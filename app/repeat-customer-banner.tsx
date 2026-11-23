'use client';
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { isFraud } from './outcomes.mjs';
import type { Dossier } from './types';

const date = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(d),
  );

// Bandeau « client récidiviste » (création d'un litige et fiche d'un dossier)
export default function RepeatCustomerBanner({
  customer,
  info,
  onOpen,
}: {
  customer: string;
  info: { matches: Dossier[]; reasons: string[]; alert: boolean };
  onOpen?: (r: Dossier) => void;
}) {
  const [all, setAll] = useState(false);
  if (!info.alert) return null;
  const list = all ? info.matches : info.matches.slice(0, 5);
  return (
    <div className="repeat-banner" role="alert">
      <ShieldAlert size={18} />
      <div>
        <b>
          Client à surveiller : {customer} — {info.reasons.join(' et ')}
        </b>
        <p>Vérifiez l’historique avant d’accorder un geste commercial.</p>
        <ul>
          {list.map((r) => (
            <li key={r.id}>
              {onOpen ? (
                <button type="button" className="text-btn" onClick={() => onOpen(r)}>
                  {r.ref}
                </button>
              ) : (
                <b>{r.ref}</b>
              )}{' '}
              · {date(r.created)} · {r.type} · {r.status}
              {r.outcome && (
                <span className={isFraud(r.outcome) ? 'repeat-fraud' : ''}> · {r.outcome}</span>
              )}
            </li>
          ))}
        </ul>
        {info.matches.length > 5 && (
          <button type="button" className="text-btn" onClick={() => setAll(!all)}>
            {all ? 'Voir moins' : 'Voir les ' + info.matches.length + ' dossiers'}
          </button>
        )}
      </div>
    </div>
  );
}
