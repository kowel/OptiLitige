'use client';
import { useState } from 'react';
import { ArrowUpRight, Receipt } from 'lucide-react';
import { CreditProcess, euros } from './credit-panel';
import { CREDIT_FAMILIES, CREDIT_KINDS, CREDIT_STATUSES, openCredits } from './credit-requests.mjs';
import { dateTime } from './datetime.mjs';
import type { CreditRequest, CreditSettingsData, Dossier, Member } from './types';

interface CreditQueueProps {
  records: Dossier[];
  member: Member;
  settings: CreditSettingsData;
  busy: boolean;
  /** Envoie l'action pour le dossier donné */
  onAction: (
    record: Dossier,
    payload: { action: string } & Record<string, unknown>,
  ) => Promise<boolean>;
  onOpen: (record: Dossier) => void;
}

const FILTERS = [
  ['all', 'Toutes'],
  ['todo', 'À émettre'],
  ['manager', 'Validation admin'],
] as const;

// « Avoirs à traiter » (service litige, responsables, admins) : toutes les demandes en cours,
// les plus anciennes d'abord, pour saisir les n° d'avoir de l'ERP en une fois (par exemple en
// fin de semaine), sans ouvrir chaque dossier.
export default function CreditQueue({
  records,
  member,
  settings,
  busy,
  onAction,
  onOpen,
}: CreditQueueProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const all = records
    .flatMap((r) => openCredits(r).map((c: CreditRequest) => ({ r, c })))
    .sort((a, b) => String(a.c.requestedAt).localeCompare(String(b.c.requestedAt)));
  const items = all.filter(({ c }) =>
    filter === 'all'
      ? true
      : filter === 'manager'
        ? c.status === 'manager'
        : c.status !== 'manager',
  );
  const total = items.reduce((n, { c }) => n + Number(c.approvedAmount ?? c.amount ?? 0), 0);
  return (
    <section className="panel credit-queue">
      <div className="credit-queue-head">
        <div>
          <h2>
            <Receipt size={19} /> Avoirs à traiter
          </h2>
          <p className="muted">
            {items.length} demande(s) · {euros(total)} au total. Faites l’avoir dans l’ERP, puis
            saisissez son numéro et validez : la demande passe en « Émis » et la personne attribuée
            au dossier est prévenue.
          </p>
        </div>
        <div className="notification-tabs" role="group" aria-label="Filtrer les demandes">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'active' : ''}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="muted">Aucune demande d’avoir en attente. Tout est à jour.</p>
      ) : (
        items.map(({ r, c }) => (
          <article key={r.id + ':' + c.id} className={'credit-card s-' + c.status}>
            <header>
              <span className={'credit-status s-' + c.status}>
                {(CREDIT_STATUSES as Record<string, string>)[c.status]}
              </span>
              <b>{euros(c.approvedAmount ?? c.amount)}</b>
              <button type="button" className="text-btn" onClick={() => onOpen(r)}>
                {r.ref} <ArrowUpRight size={13} />
              </button>
            </header>
            <p>
              <b>{r.title}</b>
              {r.customer && !r.customer.startsWith('Non renseigné') ? ' · ' + r.customer : ''}
              {r.order && !String(r.title).includes(r.order) ? ' · commande ' + r.order : ''}
            </p>
            <p className="muted">
              {(CREDIT_FAMILIES as Record<string, string>)[c.family]} · {c.reason} ·{' '}
              {(CREDIT_KINDS as Record<string, string>)[c.kind]} · Imputation : {c.imputation}
            </p>
            <p className="muted">
              Demandé par {c.requestedByName} le {dateTime(c.requestedAt)}
            </p>
            {c.comment && <p className="credit-comment">« {c.comment} »</p>}
            {c.status === 'manager' && member.role !== 'Admin' && (
              <p className="credit-hint">En attente de la validation d’un admin.</p>
            )}
            <CreditProcess
              credit={c}
              member={member}
              settings={settings}
              busy={busy}
              onAction={(payload) => onAction(r, payload)}
            />
          </article>
        ))
      )}
    </section>
  );
}
