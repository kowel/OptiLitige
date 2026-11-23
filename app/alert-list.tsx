'use client';
import { Check } from 'lucide-react';
import { dateTime } from './datetime.mjs';
import type { AlertItem, Dossier } from './types';

interface AlertListProps {
  items: AlertItem[];
  empty: string;
  busy: boolean;
  onOpen: (record: Dossier, item: AlertItem) => void;
  onRead: (keys: string[]) => void;
}

// Liste d'une catégorie de notifications « à traiter » (attributions, retours RC, hors délai).
// Ouvrir un dossier depuis la liste marque sa notification comme lue.
export default function AlertList({ items, empty, busy, onOpen, onRead }: AlertListProps) {
  if (!items.length) return <p className="muted">{empty}</p>;
  const unread = items.filter((a) => a.unread);
  return (
    <>
      {unread.length > 1 && (
        <button
          type="button"
          className="notification-read-all"
          disabled={busy}
          onClick={() => onRead(unread.map((a) => a.key))}
        >
          <Check size={12} /> Tout marquer comme lu ({unread.length})
        </button>
      )}
      {items.map((a) => (
        <article
          key={a.key}
          className={'notification-item ' + (a.unread ? 'is-unread' : '')}
          data-notification-key={a.key}
        >
          <button
            className="notification-open"
            onClick={() => {
              if (a.unread) onRead([a.key]);
              onOpen(a.record, a);
            }}
          >
            <b>{a.title}</b>
            <small>{a.text}</small>
            <small className="notification-group-count">Depuis le {dateTime(a.date)}</small>
          </button>
          <div className="notification-item-footer">
            <span className={a.unread ? 'notification-unread-label' : 'notification-read-label'}>
              {a.unread ? 'Non lue' : 'Lue'}
            </span>
            {a.unread && (
              <button
                type="button"
                className="notification-read-action"
                disabled={busy}
                onClick={() => onRead([a.key])}
              >
                <Check size={12} />
                Marquer comme lue
              </button>
            )}
          </div>
        </article>
      ))}
    </>
  );
}
