'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Link2,
  Plus,
  Scale,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import {
  CONTENTIEUX_STATUSES,
  accountKey,
  contentieuxRows,
  contentieuxStats,
  costOf,
  daysLeft,
  lossOf,
  dueDate,
  kindOf,
  matchingDossiers,
  sameCustomer,
  subsOf,
} from './contentieux.mjs';
import { csvCell } from './csv.mjs';
import { stakeOf } from './advanced-filters.mjs';
import Attachments from './attachments';
import type { Contentieux, ContentieuxSettings, Dossier, Member } from './types';

// Espace Contentieux (responsables) : liste des recours formels des clients (PayPal, opposition
// bancaire, médiation, recommandé, Signal Conso), avec date limite de réponse, décision et coûts.
// Un contentieux est relié au dossier litige de la même commande quand un responsable accepte
// la proposition. Règles : app/contentieux.mjs.

type Action = { action: string; [key: string]: unknown };
export type ContentieuxFocus = { id?: string; from?: Dossier } | null;
interface Props {
  items: Contentieux[];
  records: Dossier[];
  brands: string[];
  today: string;
  busy: boolean;
  onAction: (p: Action) => Promise<boolean>;
  onOpenDossier: (r: Dossier) => void;
  /** Contentieux à ouvrir, ou à créer depuis un dossier litige */
  focus: ContentieuxFocus;
  onFocusDone: () => void;
  /** Listes réglées dans Paramètres → Contentieux */
  settings: ContentieuxSettings;
  /** Pièces jointes : responsable connecté, démo, rechargement après un ajout ou une suppression */
  member: Member;
  demo: boolean;
  onReload: (message: string) => Promise<unknown>;
}
// Liste proposée, avec la valeur actuelle si elle en a été retirée depuis
const keep = (list: string[], current: string) =>
  current && !list.includes(current) ? [current, ...list] : list;

type Form = Record<string, string>;
const EMPTY: Form = {
  receivedAt: '',
  kind: '',
  status: 'À traiter',
  brand: '',
  customerAccount: '',
  order: '',
  productRef: '',
  amount: '',
  subject: '',
  subSubject: '',
  decision: '',
  refund: '',
  surcharge: '',
  fees: '',
  returnedProductRef: '',
  priceGap: '',
  customerMessage: '',
  customerReply: '',
  comment: '',
};
const money = (v: unknown) =>
  v === null || v === undefined || v === ''
    ? '—'
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v));
const day = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');
const toForm = (c: Contentieux): Form =>
  Object.fromEntries(
    Object.keys(EMPTY).map((k) => {
      const v = (c as unknown as Record<string, unknown>)[k];
      return [k, v === null || v === undefined ? '' : String(v)];
    }),
  );

/** Échéance lisible : « en retard de 2 j », « J-3 », « répondu » */
function Due({
  c,
  today,
  settings,
}: {
  c: Contentieux;
  today: string;
  settings: ContentieuxSettings;
}) {
  const left = daysLeft(c, today, settings);
  if (left === null)
    return <span className="ct-due done">{c.status === 'Clos' ? 'Clos' : 'Répondu'}</span>;
  return (
    <span className={'ct-due ' + (left < 0 ? 'late' : left <= 3 ? 'soon' : '')}>
      {day(dueDate(c, settings))}
      <small>
        {left < 0 ? 'en retard de ' + -left + ' j' : left === 0 ? 'aujourd’hui' : 'J-' + left}
      </small>
    </span>
  );
}

/** Type du contentieux : son nom, dans une couleur propre à chaque type (risque en infobulle) */
function Kind({ c, settings }: { c: Contentieux; settings: ContentieuxSettings }) {
  const k = kindOf(c.kind, settings);
  const i = settings.kinds.findIndex((x) => x.id === c.kind);
  const risk = k?.risk ?? c.risk;
  if (!c.kind) return <>—</>;
  return (
    <span
      className={'ct-type t' + (i < 0 ? 'x' : i % 8)}
      title={risk ? 'Niveau de risque ' + risk + (k?.gravity ? ' · ' + k.gravity : '') : undefined}
    >
      {c.kind}
    </span>
  );
}

export default function ContentieuxView({
  items,
  records,
  brands,
  today,
  busy,
  onAction,
  onOpenDossier,
  focus,
  onFocusDone,
  settings,
  member,
  demo,
  onReload,
}: Props) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [subject, setSubject] = useState('');
  // Tri par date de réception : plus récents d'abord (traitement au jour le jour)
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  // Fenêtre : contentieux ouvert (id) ou nouveau ('new')
  const [open, setOpen] = useState<string>('');
  const [form, setForm] = useState<Form>(EMPTY);
  // Création : dossier relié d'avance (ouvert depuis un dossier ou proposition acceptée)
  const [pendingLink, setPendingLink] = useState<Dossier | null>(null);
  const [pendingDeclined, setPendingDeclined] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const current = open && open !== 'new' ? items.find((c) => c.id === open) || null : null;
  const byId = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const stats = contentieuxStats(items, today, settings, records);

  function start(from?: Dossier) {
    setForm({
      ...EMPTY,
      receivedAt: today,
      brand: from?.brand || '',
      customerAccount: from?.customerAccount || '',
      order: from?.order || '',
      productRef: from?.productRef || '',
      amount: from ? String(stakeOf(from) || '') : '',
    });
    setPendingLink(from || null);
    setPendingDeclined([]);
    setConfirmDelete(false);
    setOpen('new');
  }
  function show(c: Contentieux) {
    setForm(toForm(c));
    setPendingLink(null);
    setConfirmDelete(false);
    setOpen(c.id);
  }
  // Ouverture demandée depuis un dossier litige
  useEffect(() => {
    if (!focus) return;
    const c = focus.id ? items.find((x) => x.id === focus.id) : null;

    if (c) show(c);
    else if (focus.from) start(focus.from);
    onFocusDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // Lignes dont les autres contentieux du client sont dépliés
  const [unfolded, setUnfolded] = useState<string[]>([]);
  const shown = items.filter((c) => {
    if (kind && c.kind !== kind) return false;
    if (status === 'late') {
      const l = daysLeft(c, today, settings);
      if (l === null || l >= 0) return false;
    } else if (status && c.status !== status) return false;
    if (subject && c.subject !== subject) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [
      c.ref,
      c.customerAccount,
      c.order,
      c.productRef,
      c.customerMessage,
      c.customerReply,
      c.comment,
      c.dossierRef,
      c.subSubject,
    ]
      .join(' ')
      .toLowerCase()
      .includes(s);
  });

  // Chaque contentieux a sa ligne à sa date ; ceux du même client (tous, même hors filtres) se
  // déplient en dessous de chacune de ses lignes
  const byDate = (a: Contentieux, b: Contentieux) =>
    (order === 'desc' ? 1 : -1) * String(b.receivedAt).localeCompare(String(a.receivedAt));
  const sameClient = new Map<string, Contentieux[]>();
  for (const c of [...items].sort(byDate)) {
    const key = accountKey(c.customerAccount);
    if (key) sameClient.set(key, [...(sameClient.get(key) || []), c]);
  }
  const groups = [...shown].sort(byDate).map((c) => ({
    key: c.id,
    lead: c,
    others: (sameClient.get(accountKey(c.customerAccount)) || []).filter((x) => x.id !== c.id),
  }));
  function exportCsv() {
    const { headers, rows } = contentieuxRows([...shown].sort(byDate), settings, records);
    const text = [headers, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'optilitige-contentieux.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function save() {
    const ok = await onAction({
      action: 'contentieux-save',
      ...(current ? { id: current.id, version: current.version } : {}),
      ...(!current && pendingLink ? { dossierId: pendingLink.id } : {}),
      ...(!current ? { declined: pendingDeclined } : {}),
      contentieux: form,
    });
    if (ok) setOpen('');
  }

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value, ...(key === 'subject' ? { subSubject: '' } : {}) }));
  const input = (key: string, label: string, extra: Record<string, unknown> = {}) => (
    <label>
      {label}
      <input value={form[key]} onChange={(e) => set(key, e.target.value)} {...extra} />
    </label>
  );
  const money$ = (key: string, label: string, signed = false) =>
    input(key, label, { type: 'number', step: '0.01', ...(signed ? {} : { min: '0' }) });

  // Autres contentieux du même client, et dossiers litiges de la même commande
  const draft = { ...form, id: current?.id, kind: form.kind } as unknown as Contentieux;
  const { others, same } = sameCustomer(draft, items);
  const linked = current?.dossierId
    ? byId.get(current.dossierId) ||
      ({ id: current.dossierId, ref: current.dossierRef, title: 'Dossier introuvable' } as Dossier)
    : pendingLink;
  const proposals = linked
    ? []
    : matchingDossiers(
        {
          order: form.order,
          declined: [...(current?.declined || []), ...pendingDeclined],
        },
        records,
      );
  const formKind = kindOf(form.kind, settings);
  const due = dueDate(
    {
      receivedAt: form.receivedAt,
      kind: form.kind,
      // Type inchangé : délai retenu à l'enregistrement
      legalDays: current && current.kind === form.kind ? current.legalDays : undefined,
    },
    settings,
  );

  async function link(r: Dossier, accept: boolean) {
    if (!current) {
      if (accept) setPendingLink(r);
      else setPendingDeclined((d) => [...d, r.id]);
      return;
    }
    await onAction({
      action: accept ? 'contentieux-link' : 'contentieux-decline',
      id: current.id,
      version: current.version,
      dossierId: r.id,
    });
  }

  return (
    <div className="contentieux">
      <div className="ct-stats">
        <button type="button" className="ct-stat" onClick={() => setStatus('À traiter')}>
          <span>À traiter</span>
          <strong>{stats.open}</strong>
          <small>sur {stats.total} contentieux</small>
        </button>
        <button
          type="button"
          className={'ct-stat' + (stats.late ? ' late' : '')}
          onClick={() => setStatus('late')}
        >
          <span>Délai légal dépassé</span>
          <strong>{stats.late}</strong>
          <small>{stats.soon} à répondre sous 3 jours</small>
        </button>
        <div className="ct-stat">
          <span>Coût des contentieux</span>
          <strong>{money(stats.cost)}</strong>
          <small>
            {money(stats.refund)} remboursés / avoirs · {money(stats.extra)} de frais et majorations
          </small>
        </div>
        <div className="ct-stat">
          <span>Perte réelle</span>
          <strong>{money(stats.loss)}</strong>
          <small>
            après {money(stats.deducted)} d’indemnisations transporteur (dossiers reliés)
          </small>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>
            <Scale size={18} /> Contentieux
          </h2>
          <div className="panel-actions">
            <button
              type="button"
              className="secondary"
              onClick={exportCsv}
              disabled={!shown.length}
            >
              <Download size={15} /> Exporter
            </button>
            <button type="button" className="primary" onClick={() => start()}>
              <Plus size={16} /> Nouveau contentieux
            </button>
          </div>
        </div>
        <div className="ct-filters">
          <input
            aria-label="Rechercher un contentieux"
            placeholder="Commande, client, produit, référence…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Tous les types</option>
            {settings.kinds.map((k) => (
              <option key={k.id}>{k.id}</option>
            ))}
          </select>
          <select aria-label="Statut" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {CONTENTIEUX_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
            <option value="late">Délai légal dépassé</option>
          </select>
          <select aria-label="Sujet" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Tous les sujets</option>
            {settings.subjects.map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
          <select
            aria-label="Tri par date"
            value={order}
            onChange={(e) => setOrder(e.target.value as 'desc' | 'asc')}
          >
            <option value="desc">Plus récents d’abord</option>
            <option value="asc">Plus anciens d’abord</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="ct-table">
            <thead>
              <tr>
                <th>Commande</th>
                <th>Reçu le</th>
                <th>Type</th>
                <th>Client</th>
                <th>Sujet</th>
                <th>Statut · réponse avant</th>
                <th>Décision · coût</th>
                <th>Dossier litige</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isOpen = unfolded.includes(g.key);
                return [g.lead, ...(isOpen ? g.others : [])].map((c, i) => {
                  const child = i > 0;
                  const match = !c.dossierId && matchingDossiers(c, records).length > 0;
                  return (
                    <tr
                      key={child ? g.key + '>' + c.id : c.id}
                      onClick={() => show(c)}
                      className={
                        'clickable' + (child ? ' ct-child' : g.others.length ? ' ct-lead' : '')
                      }
                    >
                      <td>
                        <b className="ct-order">{c.order || '—'}</b>
                        {!child && g.others.length > 0 && (
                          <button
                            type="button"
                            className="ct-group-toggle"
                            aria-expanded={isOpen}
                            title={
                              (isOpen ? 'Replier' : 'Afficher') +
                              ' les autres contentieux de ce client'
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnfolded((u) =>
                                isOpen ? u.filter((k) => k !== g.key) : [...u, g.key],
                              );
                            }}
                          >
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {g.others.length} autre{g.others.length > 1 ? 's' : ''} contentieux
                          </button>
                        )}
                      </td>
                      <td>{day(c.receivedAt)}</td>
                      <td>
                        <Kind c={c} settings={settings} />
                      </td>
                      <td>{c.customerAccount || '—'}</td>
                      <td>
                        {c.subject || '—'}
                        {c.subSubject && <small className="ct-sub">{c.subSubject}</small>}
                      </td>
                      <td>
                        <span className={'ct-status s-' + c.status.replace(/\W+/g, '')}>
                          {c.status}
                        </span>
                        {c.status === 'À traiter' && (
                          <Due c={c} today={today} settings={settings} />
                        )}
                      </td>
                      <td>
                        {c.decision || '—'}
                        {costOf(c) > 0 &&
                          (() => {
                            const l = lossOf(c, records);
                            return (
                              <small
                                className="ct-sub"
                                title="Coût = remboursé / avoir + majoration + frais ; perte réelle = coût − indemnisation transporteur du dossier relié"
                              >
                                Coût {money(l.cost)}
                                {l.deducted > 0 && (
                                  <span className="ct-loss"> · perte réelle {money(l.loss)}</span>
                                )}
                              </small>
                            );
                          })()}
                      </td>
                      <td>
                        {c.dossierRef ? (
                          <span className="ct-linked">
                            <Link2 size={13} /> {c.dossierRef}
                          </span>
                        ) : match ? (
                          <span className="ct-to-link">À relier ?</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
              {!shown.length && (
                <tr>
                  <td colSpan={8} className="muted">
                    {items.length
                      ? 'Aucun contentieux ne correspond à ces filtres.'
                      : 'Aucun contentieux pour l’instant : « Nouveau contentieux » pour enregistrer le premier.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {open && (
        <div className="modal-overlay" onClick={() => !busy && setOpen('')}>
          <section
            className="modal large"
            role="dialog"
            aria-modal="true"
            aria-label={current ? 'Contentieux ' + current.ref : 'Nouveau contentieux'}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-btn"
              aria-label="Fermer"
              onClick={() => setOpen('')}
            >
              <X size={18} />
            </button>
            <span className="eyebrow">RESPONSABLES · CONTENTIEUX</span>
            <h2>{current ? current.ref : 'Nouveau contentieux'}</h2>
            <p>
              {current
                ? 'Enregistré le ' + day(current.createdAt) + ' par ' + current.createdBy + '.'
                : 'Recours du client (PayPal, opposition bancaire, médiation, recommandé, Signal Conso).'}
            </p>

            {/* Dossier litige de la même commande : liaison proposée, à accepter ou refuser */}
            {linked ? (
              <div className="ct-link-box linked">
                <Link2 size={16} />
                <div>
                  <b>Relié au dossier litige {linked.ref}</b>
                  <small>
                    {linked.title} · {linked.status} · ouvert le {day(linked.created)}
                  </small>
                </div>
                {byId.get(linked.id) && (
                  <button type="button" className="text-btn" onClick={() => onOpenDossier(linked)}>
                    Ouvrir le dossier
                  </button>
                )}
                <button
                  type="button"
                  className="text-btn"
                  disabled={busy}
                  onClick={() =>
                    current
                      ? onAction({
                          action: 'contentieux-unlink',
                          id: current.id,
                          version: current.version,
                        })
                      : setPendingLink(null)
                  }
                >
                  <Unlink size={13} /> Retirer la liaison
                </button>
              </div>
            ) : (
              proposals.map((r) => (
                <div
                  key={r.id}
                  className="ct-link-box"
                  role="group"
                  aria-label="Dossier litige à relier"
                >
                  <Link2 size={16} />
                  <div>
                    <b>
                      Un dossier litige existe pour la commande {r.order} : {r.ref}
                    </b>
                    <small>
                      {r.title} · {r.status} · ouvert le {day(r.created)} · {r.type}
                      {r.carrier && r.carrier !== '—' ? ' · ' + r.carrier : ''} · montant{' '}
                      {money(stakeOf(r))}
                      {r.outcome ? ' · résultat : ' + r.outcome : ''}
                    </small>
                    <span className="ct-link-actions">
                      <button
                        type="button"
                        className="primary small-btn"
                        disabled={busy}
                        onClick={() => link(r, true)}
                      >
                        <Check size={14} /> Relier ce dossier
                      </button>
                      <button
                        type="button"
                        className="secondary small-btn"
                        disabled={busy}
                        onClick={() => link(r, false)}
                      >
                        Ce n’est pas le même
                      </button>
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* Dossier relié : coût du contentieux moins l'indemnisation obtenue du transporteur */}
            {linked &&
              byId.get(linked.id) &&
              (() => {
                const comp = Number(byId.get(linked.id)?.compensation) || 0;
                const l = lossOf(
                  {
                    refund: form.refund,
                    surcharge: form.surcharge,
                    fees: form.fees,
                    dossierId: linked.id,
                  } as unknown as Contentieux,
                  records,
                );
                return (
                  <div className="ct-loss-box" role="group" aria-label="Perte réelle">
                    <div>
                      <small>Coût du contentieux</small>
                      <b>{money(l.cost)}</b>
                      <span>remboursé / avoir + majoration + frais</span>
                    </div>
                    <div>
                      <small>Indemnisation transporteur</small>
                      <b>− {money(l.deducted)}</b>
                      <span>
                        dossier {linked.ref}
                        {comp > l.deducted ? ' (sur ' + money(comp) + ' reçus)' : ''}
                        {!comp ? ' : aucune indemnisation saisie' : ''}
                      </span>
                    </div>
                    <div className="ct-loss-total">
                      <small>Perte réelle</small>
                      <b>{money(l.loss)}</b>
                    </div>
                  </div>
                );
              })()}

            {/* Client déjà connu : ses autres contentieux, et un même recours sur la même commande */}
            {others.length > 0 && (
              <div className={'ct-repeat-box' + (same.length ? ' same' : '')} role="note">
                <AlertTriangle size={16} />
                <div>
                  <b>
                    {same.length
                      ? 'Déjà un contentieux « ' + form.kind + ' » pour cette commande'
                      : 'Ce client a déjà ' + others.length + ' autre(s) contentieux'}
                  </b>
                  <ul>
                    {others.slice(0, 6).map((o) => (
                      <li key={o.id}>
                        <button type="button" className="text-btn" onClick={() => show(o)}>
                          {o.ref}
                        </button>{' '}
                        · {o.kind} · reçu le {day(o.receivedAt)} · commande {o.order || '—'} ·{' '}
                        {o.status}
                        {o.decision ? ' · ' + o.decision : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="form-grid">
                {input('receivedAt', 'Date de réception *', {
                  type: 'date',
                  required: true,
                  max: today,
                })}
                <label>
                  Type de contentieux *
                  <select required value={form.kind} onChange={(e) => set('kind', e.target.value)}>
                    <option value="">Choisir…</option>
                    {current?.kind && !formKind && form.kind === current.kind && (
                      <option value={current.kind}>{current.kind}</option>
                    )}
                    {settings.kinds.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.id} ({k.days} j)
                      </option>
                    ))}
                  </select>
                </label>
                {due && (
                  <p className="span2 ct-due-note">
                    Délai légal de réponse :{' '}
                    {current && current.kind === form.kind && current.legalDays
                      ? current.legalDays
                      : formKind?.days}{' '}
                    jours · réponse attendue avant le <b>{day(due)}</b>
                    {formKind ? ' · gravité ' + formKind.gravity.toLowerCase() : ''}
                  </p>
                )}
                <label>
                  Statut
                  <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                    {CONTENTIEUX_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Enseigne
                  <select value={form.brand} onChange={(e) => set('brand', e.target.value)}>
                    <option value="">—</option>
                    {(form.brand && !brands.includes(form.brand)
                      ? [form.brand, ...brands]
                      : brands
                    ).map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>
                {input('customerAccount', 'Client (n° de compte)', { maxLength: 60 })}
                {input('order', 'N° de commande', { maxLength: 100 })}
                {input('productRef', 'Réf. produit', { maxLength: 200 })}
                {money$('amount', 'Montant concerné (€)')}
                <label>
                  Sujet
                  <select value={form.subject} onChange={(e) => set('subject', e.target.value)}>
                    <option value="">—</option>
                    {keep(
                      settings.subjects.map((s) => s.name),
                      current?.subject === form.subject ? form.subject : '',
                    ).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Sous-sujet
                  <select
                    value={form.subSubject}
                    disabled={!form.subject}
                    onChange={(e) => set('subSubject', e.target.value)}
                  >
                    <option value="">{form.subject ? '—' : 'Choisissez d’abord le sujet'}</option>
                    {keep(
                      subsOf(form.subject, settings),
                      current?.subSubject === form.subSubject && current?.subject === form.subject
                        ? form.subSubject
                        : '',
                    ).map((s: string) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Décision{form.status === 'Clos' ? ' *' : ''}
                  <select
                    value={form.decision}
                    required={form.status === 'Clos'}
                    onChange={(e) => set('decision', e.target.value)}
                  >
                    <option value="">—</option>
                    {keep(
                      settings.decisions,
                      current?.decision === form.decision ? form.decision : '',
                    ).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                {money$('refund', 'Montant remboursé / avoir (€)')}
                {money$('surcharge', 'Montant majoration (€)')}
                {money$('fees', 'Montant frais (€)')}
                {input('returnedProductRef', 'Réf. produit renvoyé', { maxLength: 200 })}
                {money$('priceGap', 'Écart de prix (€)', true)}
                <label className="span2">
                  Message client
                  <textarea
                    rows={5}
                    maxLength={20000}
                    placeholder="Collez ici le message du client"
                    value={form.customerMessage}
                    onChange={(e) => set('customerMessage', e.target.value)}
                  />
                </label>
                <label className="span2">
                  Réponse apportée au client
                  <textarea
                    rows={5}
                    maxLength={20000}
                    placeholder="Collez ici la réponse envoyée au client"
                    value={form.customerReply}
                    onChange={(e) => set('customerReply', e.target.value)}
                  />
                </label>
                <label className="span2">
                  Commentaire
                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={form.comment}
                    onChange={(e) => set('comment', e.target.value)}
                  />
                </label>
                <div className="span2 ct-attachments">
                  <span className="ct-attachments-title">
                    Pièces jointes
                    {current?.attachments?.length ? ' (' + current.attachments.length + ')' : ''}
                  </span>
                  {current ? (
                    <Attachments
                      key={current.id}
                      record={current}
                      member={member}
                      demo={demo}
                      contentieux
                      onChanged={onReload}
                    />
                  ) : (
                    <p className="muted">
                      Enregistrez d’abord le contentieux pour y ajouter des pièces jointes.
                    </p>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                {current ? (
                  confirmDelete ? (
                    <span className="ct-delete">
                      Supprimer définitivement {current.ref} ?
                      <button
                        type="button"
                        className="text-btn danger"
                        disabled={busy}
                        onClick={async () => {
                          if (await onAction({ action: 'contentieux-delete', id: current.id }))
                            setOpen('');
                        }}
                      >
                        Oui, supprimer
                      </button>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Annuler
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-btn ct-delete-btn"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={14} /> Supprimer (saisie en erreur)
                    </button>
                  )
                ) : (
                  <span>Visible des admins seulement.</span>
                )}
                <button className="primary" disabled={busy}>
                  <Check size={16} /> {busy ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>

            {current && current.history.length > 0 && (
              <div className="ct-history">
                <small>Historique</small>
                <ul>
                  {[...current.history].reverse().map((h, i) => (
                    <li key={i}>
                      <b>{day(h.date)}</b> · {h.author} : {h.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
