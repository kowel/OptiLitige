'use client';
import { stakeOf } from './advanced-filters.mjs';
import { useState } from 'react';
import { Check, Plus, Receipt, Send, X } from 'lucide-react';
import {
  CREDIT_FAMILIES,
  CREDIT_KINDS,
  CREDIT_STATUSES,
  canRequestCredit,
  creditPermissions,
  needsManager,
  suggestCredit,
} from './credit-requests.mjs';
import { dateTime } from './datetime.mjs';
import type { CreditRequest, CreditSettingsData, Dossier, Member } from './types';

type CreditAction = (payload: { action: string } & Record<string, unknown>) => Promise<boolean>;

interface CreditPanelProps {
  record: Dossier;
  member: Member;
  settings: CreditSettingsData;
  busy: boolean;
  onAction: CreditAction;
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

// Saisie en cours sur une demande (montant accordé, n° d'avoir, date, commentaire)
interface CreditWork {
  amount?: number | string;
  comment?: string;
  number?: string;
  date?: string;
}

export const euros = (v: unknown) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
const day = (v?: string) => (v ? new Date(v + 'T12:00:00Z').toLocaleDateString('fr-FR') : '');
const todayInput = () => new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });

// Traitement d'une demande en une étape : montant accordé, n° d'avoir ERP, date, puis
// « Valider l'avoir » (émis) ou « Refuser » (motif obligatoire). Au-delà du seuil réglé, le
// service litige transmet à un admin. Utilisé dans l'onglet Avoirs d'un dossier et dans la vue
// « Avoirs à traiter » (app/credit-queue.tsx). onAction envoie l'action pour CE dossier.
export function CreditProcess({
  credit: c,
  member,
  settings,
  busy,
  onAction,
}: {
  credit: CreditRequest;
  member: Member;
  settings: CreditSettingsData;
  busy: boolean;
  onAction: CreditAction;
}) {
  const [w, setWork] = useState<CreditWork>({});
  const setW = (patch: CreditWork) => setWork({ ...w, ...patch });
  const can = creditPermissions(c, member);
  if (!can.issue && !can.refuse && !can.cancel) return null;
  const amount = w.amount ?? c.approvedAmount ?? c.amount;
  // Montant au-delà du seuil : seul un admin peut émettre (sauf montant déjà validé par un admin)
  const validated = c.status === 'accepted' && Number(amount) === (c.approvedAmount ?? c.amount);
  const toAdmin = member.role !== 'Admin' && !validated && needsManager(c.family, amount, settings);
  const number = String(w.number || '').trim();
  return (
    <div className="credit-actions">
      {can.issue && (
        <>
          <label>
            Montant accordé (€)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setW({ amount: e.target.value })}
            />
          </label>
          {!toAdmin && (
            <>
              <label>
                N° d’avoir (ERP)
                <input
                  maxLength={60}
                  value={w.number || ''}
                  onChange={(e) => setW({ number: e.target.value })}
                />
              </label>
              <label>
                Date d’émission
                <input
                  type="date"
                  value={w.date || todayInput()}
                  onChange={(e) => setW({ date: e.target.value })}
                />
              </label>
            </>
          )}
        </>
      )}
      {(can.issue || can.refuse) && (
        <label className="grow">
          Commentaire {can.refuse ? '(obligatoire pour refuser)' : ''}
          <input
            maxLength={2000}
            value={w.comment || ''}
            onChange={(e) => setW({ comment: e.target.value })}
          />
        </label>
      )}
      {can.issue && toAdmin && (
        <small className="credit-hint">
          Au-delà de {euros(settings.managerAbove[c.family])}, un admin doit valider cet avoir.
        </small>
      )}
      <div className="credit-buttons">
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
              })) && setWork({})
            }
          >
            <X size={14} /> Refuser
          </button>
        )}
        {can.issue &&
          (toAdmin ? (
            can.decide && (
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() =>
                  onAction({
                    action: 'credit-decision',
                    creditId: c.id,
                    decision: 'accept',
                    amount,
                    comment: w.comment,
                  })
                }
              >
                <Send size={14} /> Transmettre à un admin
              </button>
            )
          ) : (
            <button
              type="button"
              className="primary"
              disabled={busy || !number}
              title={number ? '' : 'Indiquez le n° d’avoir de l’ERP'}
              onClick={async () =>
                (await onAction({
                  action: 'credit-issue',
                  creditId: c.id,
                  amount,
                  number,
                  date: w.date || todayInput(),
                  comment: w.comment,
                })) && setWork({})
              }
            >
              <Receipt size={14} /> Valider l’avoir
            </button>
          ))}
      </div>
    </div>
  );
}

// Onglet « Avoirs » d'un dossier : visible par tous ; demandes et traitement réservés au
// service litige, aux responsables et aux admins (la RC et le SAV consultent).
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
  const [form, setForm] = useState<CreditForm | null>(null);
  const canRequest = canRequestCredit(member);
  const familyLimit = (family: string) =>
    settings.managerAbove?.[family] === null || settings.managerAbove?.[family] === undefined
      ? 'Traitée par le service litige, quel que soit le montant.'
      : 'Validation admin au-delà de ' + euros(settings.managerAbove[family]) + '.';
  const managerHint = (family: string, amount: unknown) =>
    member.role !== 'Admin' && needsManager(family, amount, settings)
      ? 'Au-delà de ' + euros(settings.managerAbove[family]) + ', un admin doit valider.'
      : '';

  return (
    <div className="credit-panel">
      {!canRequest && (
        <p className="credit-hint">
          Consultation seule : le service litige demande et traite les avoirs. Pour en demander un,
          écrivez-lui dans les échanges du dossier.
        </p>
      )}
      {credits.length === 0 && !form && (
        <p className="muted">Aucune demande d’avoir pour ce dossier.</p>
      )}
      {credits
        .slice()
        .reverse()
        .map((c) => (
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
            {c.status === 'manager' && member.role !== 'Admin' && (
              <p className="credit-hint">En attente de la validation d’un admin.</p>
            )}
            <CreditProcess
              credit={c}
              member={member}
              settings={settings}
              busy={busy}
              onAction={onAction}
            />
          </article>
        ))}

      {canRequest &&
        (form ? (
          <form
            className="credit-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await onAction({ action: 'credit-request', request: form })) setForm(null);
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
                Commentaire
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
            <p className="muted">
              La demande apparaît dans « Avoirs à traiter » : vous pourrez y saisir le n° d’avoir de
              l’ERP tout de suite ou plus tard.
            </p>
            <div className="credit-buttons">
              <button type="button" className="secondary" onClick={() => setForm(null)}>
                Annuler
              </button>
              <button className="primary" disabled={busy}>
                <Check size={14} /> Enregistrer la demande
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
