'use client';
import {
  AlarmClock,
  AtSign,
  BadgeEuro,
  Check,
  ChevronRight,
  Clock,
  Hand,
  MessageSquareReply,
  PartyPopper,
  Timer,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dossier } from './types';

export interface DayItem {
  key: string;
  record: Dossier;
  kind: 'reminder' | 'late' | 'soon' | 'take' | 'followup' | 'alert' | 'mention';
  title: string;
  text: string;
  unread?: boolean;
  late?: boolean;
  reminderId?: string;
  mention?: { record: Dossier; unreadIds: string[] };
}
export interface DaySection {
  id: string;
  title: string;
  hint: string;
  items: DayItem[];
}

const ICONS: Record<string, LucideIcon> = {
  reminders: AlarmClock,
  late: Timer,
  soon: Clock,
  new: Hand,
  followups: Truck,
  credits: BadgeEuro,
  rc: MessageSquareReply,
  messages: AtSign,
};

// Écran « Ma journée » : la liste des choses à faire aujourd'hui, avec un bouton pour agir
export default function MyDay({
  name,
  sections,
  total,
  busy,
  canEdit,
  onOpen,
  onDone,
  onRead,
  onReadMention,
  onTake,
  onFollowupDone,
}: {
  name: string;
  sections: DaySection[];
  total: number;
  busy: boolean;
  canEdit: boolean;
  onOpen: (r: Dossier, tab?: string) => void;
  onDone: (reminderId: string) => void;
  onRead: (keys: string[]) => void;
  onReadMention: (m: { record: Dossier; unreadIds: string[] }) => void;
  onTake: (r: Dossier) => void;
  onFollowupDone: (r: Dossier) => void;
}) {
  const filled = sections.filter((s) => s.items.length);
  const hour = new Date().getHours();
  return (
    <div className="my-day">
      <div className="my-day-summary">
        <div>
          <h2>
            {hour < 18 ? 'Bonjour' : 'Bonsoir'} {name.split(' ')[0]},
          </h2>
          <p>
            {total
              ? total + ' élément(s) à traiter aujourd’hui, du plus urgent au moins urgent.'
              : 'Rien à traiter pour le moment : tout est à jour.'}
          </p>
        </div>
        <div className="my-day-chips">
          {filled.map((s) => {
            const Icon = ICONS[s.id] || Clock;
            return (
              <a key={s.id} href={'#jour-' + s.id} className={'day-chip ' + s.id}>
                <Icon size={14} /> {s.title} <b>{s.items.length}</b>
              </a>
            );
          })}
        </div>
      </div>
      {!filled.length && (
        <div className="panel my-day-empty">
          <PartyPopper size={28} />
          <p>Votre journée est dégagée. Les nouveautés s’afficheront ici dès qu’elles arrivent.</p>
        </div>
      )}
      {filled.map((s) => {
        const Icon = ICONS[s.id] || Clock;
        return (
          <section key={s.id} id={'jour-' + s.id} className={'panel day-section ' + s.id}>
            <div className="panel-heading">
              <h2>
                <Icon size={17} /> {s.title} <span className="day-count">{s.items.length}</span>
              </h2>
              <small>{s.hint}</small>
            </div>
            <ul>
              {s.items.map((it) => (
                <li key={it.key} className={it.late || it.kind === 'late' ? 'is-late' : undefined}>
                  <button type="button" className="day-main" onClick={() => onOpen(it.record)}>
                    <b>{it.title}</b>
                    <small>{it.text}</small>
                  </button>
                  <span className="day-actions">
                    {it.kind === 'reminder' && it.reminderId && (
                      <button
                        type="button"
                        className="secondary small-btn"
                        disabled={busy}
                        onClick={() => onDone(it.reminderId!)}
                      >
                        <Check size={14} /> Fait
                      </button>
                    )}
                    {it.kind === 'followup' && canEdit && (
                      <button
                        type="button"
                        className="secondary small-btn"
                        disabled={busy}
                        title="Relance faite : la prochaine est repoussée automatiquement"
                        onClick={() => onFollowupDone(it.record)}
                      >
                        <Check size={14} /> Relance faite
                      </button>
                    )}
                    {it.kind === 'take' && canEdit && (
                      <button
                        type="button"
                        className="secondary small-btn"
                        disabled={busy}
                        onClick={() => onTake(it.record)}
                      >
                        <Hand size={14} /> Prendre en charge
                      </button>
                    )}
                    {it.kind === 'alert' && it.unread && (
                      <button
                        type="button"
                        className="text-btn"
                        disabled={busy}
                        onClick={() => onRead([it.key])}
                      >
                        Marquer lu
                      </button>
                    )}
                    {it.kind === 'mention' && it.mention && (
                      <button
                        type="button"
                        className="text-btn"
                        disabled={busy}
                        onClick={() => onReadMention(it.mention!)}
                      >
                        Marquer lu
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary small-btn"
                      onClick={() =>
                        onOpen(it.record, it.kind === 'followup' ? 'Transporteur' : undefined)
                      }
                    >
                      {it.kind === 'followup' ? 'Relancer' : 'Ouvrir'} <ChevronRight size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
