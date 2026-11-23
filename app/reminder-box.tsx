'use client';
import { useState } from 'react';
import { AlarmClock, Check, X } from 'lucide-react';
import { parisToday } from './reminders.mjs';

export interface Reminder {
  id: string;
  recordId: string;
  date: string;
  note: string;
  createdAt?: string;
}

const day = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(
    new Date(d + 'T12:00:00'),
  );
const plusDays = (n: number) => {
  const d = new Date(parisToday() + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Fiche d'un dossier : « Me rappeler le… » (rappels personnels, visibles par l'agent seul)
export default function ReminderBox({
  reminders,
  busy,
  onAdd,
  onDelete,
}: {
  reminders: Reminder[];
  busy: boolean;
  onAdd: (date: string, note: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(plusDays(2));
  const [note, setNote] = useState('');
  const today = parisToday();
  return (
    <div className="reminder-box">
      {reminders.map((r) => (
        <span key={r.id} className={'reminder-chip' + (r.date <= today ? ' due' : '')}>
          <AlarmClock size={13} />
          <b>{r.date === today ? 'Aujourd’hui' : day(r.date)}</b>
          {r.note && <span>{r.note}</span>}
          <button
            type="button"
            className="icon-btn"
            aria-label="Supprimer le rappel"
            title={r.date <= today ? 'Fait : supprimer le rappel' : 'Supprimer le rappel'}
            disabled={busy}
            onClick={() => onDelete(r.id)}
          >
            {r.date <= today ? <Check size={13} /> : <X size={13} />}
          </button>
        </span>
      ))}
      {!open ? (
        <button type="button" className="text-btn" onClick={() => setOpen(true)}>
          <AlarmClock size={14} /> Me rappeler le…
        </button>
      ) : (
        <form
          className="reminder-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onAdd(date, note)) {
              setOpen(false);
              setNote('');
            }
          }}
        >
          <div className="reminder-quick">
            {[
              ['Demain', 1],
              ['Dans 3 jours', 3],
              ['Dans 1 semaine', 7],
            ].map(([label, n]) => (
              <button
                key={label}
                type="button"
                className={date === plusDays(n as number) ? 'active' : ''}
                onClick={() => setDate(plusDays(n as number))}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            Date
            <input
              type="date"
              min={today}
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="reminder-note">
            Note (facultatif)
            <input
              value={note}
              maxLength={300}
              placeholder="Ex. rappeler le client si pas de nouvelle du transporteur"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button className="primary small-btn" disabled={busy}>
            <Check size={14} /> Programmer
          </button>
          <button type="button" className="text-btn" onClick={() => setOpen(false)}>
            Annuler
          </button>
        </form>
      )}
    </div>
  );
}
