'use client';
import { stakeOf } from './advanced-filters.mjs';
import { useState } from 'react';
import { Check, Mail, Plus, Receipt, X } from 'lucide-react';
import { DEFAULT_CREDIT_NOTIFY, creditRequestMail } from './credit-mail.mjs';
import {
  CREDIT_FAMILIES,
  CREDIT_KINDS,
  CREDIT_STATUSES,
  creditPermissions,
  needsManager,
  suggestCredit,
} from './credit-requests.mjs';
import { dateTime } from './datetime.mjs';
import type { CreditRequest, CreditSettingsData, Dossier, Member } from './types';

interface CreditPanelProps {
  record: Dossier;
  member: Member;
  settings: CreditSettingsData;
  busy: boolean;
  onAction: (payload: { action: string } & Record<string, unknown>) => Promise<boolean>;
}

// Formulaire de nouvelle demande d'avoir
interface CreditForm {
  family: string;
  reason: string;
  imputation: string;
  kind: string;
  amount: number | string;
  comment: string;
}

// Saisie en cours sur une demande existante (décision, émission)
interface CreditWork {
  amount?: number | string;
  comment?: string;
  number?: string;
  date?: string;
}

const euros = (v: unknown) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
const day = (v?: string) => (v ? new Date(v + 'T12:00:00Z').toLocaleDateString('fr-FR') : '');
const todayInput = () => new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });

// Onglet « Avoirs » d'un dossier : demandes, décisions, émission dans l'ERP.
// onAction(payload) envoie l'action au serveur (ou à la démonstration) et renvoie true si
// elle a réussi.
export default function CreditPanel({
  record,
  member,
  settings,
  busy,
  onAction,
}: CreditPanelProps) {
  const credits: CreditRequest[] = record.credits || [];
  const suggestion = suggestCredit(record.type, settings);
  const blank: CreditForm = {
    ...suggestion,
    kind: 'partial',
    amount: '',
    comment: '',
  };
  // E-mail « Nouvelle demande d'avoir » proposé juste après la demande
  const [mail, setMail] = useState<{ href: string } | null>(null);
  const [form, setForm] = useState<CreditForm | null>(null),
    [work, setWork] = useState<Record<string, CreditWork>>({});
  const setW = (id: string, patch: CreditWork) =>
    setWork({ ...work, [id]: { ...work[id], ...patch } });
  const managerHint = (family: string, amount: unknown) =>
    needsManager(family, amount, settings)
      ? 'Au-delà de ' + euros(settings.managerAbove[family]) + ', un admin doit valider.'
      : '';
  const familyLimit = (family: string) =>
    settings.managerAbove?.[family] === null || settings.managerAbove?.[family] === undefined
      ? 'Validée par le service litige, quel que soit le montant.'
      : 'Validation admin au-delà de ' + euros(settings.managerAbove[family]) + '.';

  return (
    <div className="credit-panel">
      {credits.length === 0 && !form && (
        <p className="muted">Aucune demande d’avoir pour ce dossier.</p>
      )}
      {credits
        .slice()
        .reverse()
        .map((c) => {
          const can = creditPermissions(c, member);
          const w = work[c.id] || {};
          return (
            <article key={c.id} className={'credit-card s-' + c.status}>
              <header>
                <span className={'credit-status s-' + c.status}>
                  {(CREDIT_STATUSES as Record<string, string>)[c.status]}
                </span>
                <b>
                  {euros(c.approvedAmount ?? c.amount)}
                  {c.approvedAmount !== undefined && c.approvedAmount !== c.amount && (
                    <small> (demandé : {euros(c.amount)})</small>
                  )}
                </b>
              </header>
              <p>
                <b>{(CREDIT_FAMILIES as Record<string, string>)[c.family]}</b> · {c.reason}
              </p>
              <p className="muted">
                {(CREDIT_KINDS as Record<string, string>)[c.kind]} · Imputation : {c.imputation}
              </p>
              {c.comment && <p className="credit-comment">« {c.comment} »</p>}
              <ul className="credit-steps">
                <li>
                  Demandé par {c.requestedByName} le {dateTime(c.requestedAt)}
                </li>
                {c.review && (
                  <li>
                    Transmis à un admin par {c.review.byName} le {dateTime(c.review.at)}
                    {c.review.comment ? ' · ' + c.review.comment : ''}
                  </li>
                )}
                {c.decision && (
                  <li>
                    {c.status === 'refused' ? 'Refusé' : 'Accepté'} par {c.decision.byName} le{' '}
                    {dateTime(c.decision.at)}
                    {c.decision.comment ? ' · ' + c.decision.comment : ''}
                  </li>
                )}
                {c.issue && (
                  <li>
                    Émis dans l’ERP : n° <b>{c.issue.number}</b> du {day(c.issue.date)} · enregistré
                    par {c.issue.byName}
                  </li>
                )}
                {c.cancel && (
                  <li>
                    Annulé par {c.cancel.byName} le {dateTime(c.cancel.at)}
                  </li>
                )}
              </ul>
              {c.status === 'manager' && !can.decide && (
                <p className="credit-hint">En attente de la validation d’un admin.</p>
              )}

              {(can.decide || can.refuse) && (
                <div className="credit-actions">
                  {can.decide && (
                    <label>
                      Montant accordé (€)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={w.amount ?? c.approvedAmount ?? c.amount}
                        onChange={(e) => setW(c.id, { amount: e.target.value })}
                      />
                    </label>
                  )}
                  <label className="grow">
                    Commentaire {can.refuse ? '(obligatoire pour refuser)' : ''}
                    <input
                      maxLength={2000}
                      value={w.comment || ''}
                      onChange={(e) => setW(c.id, { comment: e.target.value })}
                    />
                  </label>
                  {can.decide && member.role !== 'Admin' && (
                    <small className="credit-hint">
                      {managerHint(c.family, w.amount ?? c.approvedAmount ?? c.amount)}
                    </small>
                  )}
                  <div className="credit-buttons">
                    {can.refuse && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy || !String(w.comment || '').trim()}
                        onClick={async () =>
                          (await onAction({
                            action: 'credit-decision',
                            creditId: c.id,
                            decision: 'refuse',
                            comment: w.comment,
                          })) && setW(c.id, { comment: '' })
                        }
                      >
                        <X size={14} /> Refuser
                      </button>
                    )}
                    {can.decide && (
                      <button
                        type="button"
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          onAction({
                            action: 'credit-decision',
                            creditId: c.id,
                            decision: 'accept',
                            amount: w.amount ?? c.approvedAmount ?? c.amount,
                            comment: w.comment,
                          })
                        }
                      >
                        <Check size={14} /> Accepter
                      </button>
                    )}
                  </div>
                </div>
              )}

              {can.issue && (
                <div className="credit-actions">
                  <label>
                    N° d’avoir (ERP)
                    <input
                      maxLength={60}
                      value={w.number || ''}
                      onChange={(e) => setW(c.id, { number: e.target.value })}
                    />
                  </label>
                  <label>
                    Date d’émission
                    <input
                      type="date"
                      value={w.date || todayInput()}
                      onChange={(e) => setW(c.id, { date: e.target.value })}
                    />
                  </label>
                  <div className="credit-buttons">
                    <button
                      type="button"
                      className="primary"
                      disabled={busy || !String(w.number || '').trim()}
                      onClick={() =>
                        onAction({
                          action: 'credit-issue',
                          creditId: c.id,
                          number: w.number,
                          date: w.date || todayInput(),
                        })
                      }
                    >
                      <Receipt size={14} /> Enregistrer l’avoir émis
                    </button>
                  </div>
                </div>
              )}

              {can.cancel && (
                <button
                  type="button"
                  className="text-btn credit-cancel"
                  disabled={busy}
                  onClick={() =>
                    window.confirm('Annuler cette demande d’avoir ?') &&
                    onAction({ action: 'credit-cancel', creditId: c.id })
                  }
                >
                  Annuler la demande
                </button>
              )}
            </article>
          );
        })}

      {mail && (
        <div className="credit-mail" role="status">
          <Mail size={16} />
          <span>
            Demande enregistrée. Prévenez {settings.notify?.name || 'le destinataire'} par e-mail :
            le message est prêt, vous le relisez avant de l’envoyer.
          </span>
          <a className="primary" href={mail.href} onClick={() => setMail(null)}>
            Ouvrir l’e-mail
          </a>
          <button type="button" className="text-btn" onClick={() => setMail(null)}>
            Plus tard
          </button>
        </div>
      )}
      {member.role !== 'Désactivé' &&
        (form ? (
          <form
            className="credit-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const request = form;
              if (await onAction({ action: 'credit-request', request })) {
                setForm(null);
                // E-mail tout prêt pour le destinataire réglé (Paramètres → Avoirs)
                setMail(
                  creditRequestMail(
                    record,
                    request,
                    settings.notify || DEFAULT_CREDIT_NOTIFY,
                    window.location.origin,
                    member.name,
                  ),
                );
              }
            }}
          >
            <h3>Demander un avoir</h3>
            <div className="form-grid">
              <label>
                Famille de motif
                <select
                  value={form.family}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      family: e.target.value,
                      reason: settings.reasons[e.target.value][0],
                    })
                  }
                >
                  {Object.entries(CREDIT_FAMILIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v as string}
                    </option>
                  ))}
                </select>
                <small>{familyLimit(form.family)}</small>
              </label>
              <label>
                Motif
                <select
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                >
                  {settings.reasons[form.family].map((r: string) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                Type d’avoir
                <select
                  value={form.kind}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      kind: e.target.value,
                      amount:
                        e.target.value === 'total' && !form.amount ? stakeOf(record) : form.amount,
                    })
                  }
                >
                  {Object.entries(CREDIT_KINDS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v as string}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Montant demandé (€)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
                <small>Montant concerné par le litige : {euros(stakeOf(record))}</small>
              </label>
              <label>
                Imputation (qui porte le coût)
                <select
                  value={form.imputation}
                  onChange={(e) => setForm({ ...form, imputation: e.target.value })}
                >
                  {settings.imputations.map((r: string) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="span2">
                Commentaire pour le service litige
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  placeholder="Contexte, échange avec le client, justification…"
                />
              </label>
            </div>
            {managerHint(form.family, form.amount) && (
              <p className="credit-hint">{managerHint(form.family, form.amount)}</p>
            )}
            <div className="credit-buttons">
              <button type="button" className="secondary" onClick={() => setForm(null)}>
                Annuler
              </button>
              <button className="primary" disabled={busy}>
                <Check size={14} /> Envoyer la demande
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="secondary credit-new" onClick={() => setForm(blank)}>
            <Plus size={15} /> Demander un avoir
          </button>
        ))}
    </div>
  );
}
