'use client';
import { stakeOf } from './advanced-filters.mjs';
import { createPortal } from 'react-dom';
import { contentTypeOf, formatSize, isInline } from './attachment-rules.mjs';
import { dateTime, importInfo } from './datetime.mjs';
import { CREDIT_FAMILIES, CREDIT_STATUSES } from './credit-requests.mjs';
import type { ReactNode } from 'react';
import type { Attachment, Dossier, Member } from './types';

interface PrintSheetProps {
  record: Dossier;
  members: Member[];
  me: Member;
}

// Fiche récapitulative d'un dossier, prévue pour l'impression ou l'enregistrement en PDF
// (bouton « Fiche PDF » → fenêtre d'impression du navigateur → « Enregistrer au format PDF »).
// Invisible à l'écran : seule la feuille d'impression l'affiche (voir .print-sheet dans
// globals.css).
const money = (v: unknown) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
const day = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) : '—';

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === undefined || value === null || value === '' || value === '—') return null;
  return (
    <div className="ps-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function PrintSheet({ record: r, members, me }: PrintSheetProps) {
  // Rendue directement dans <body> pour que la feuille d'impression masque tout le reste
  const name = (email: string) => members?.find((m) => m.email === email)?.name || email || '—';
  const imported = importInfo(r);
  const attachments: Attachment[] = r.attachments || [];
  const photos = attachments.filter((a) => isInline(contentTypeOf(a.name)));
  const url = (a: Attachment) =>
    '/api/attachments?id=' + encodeURIComponent(r.id) + '&att=' + encodeURIComponent(a.id);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="print-sheet" aria-hidden="true">
      <header className="ps-header">
        <div>
          <img src="/groupe-cybertek.png" alt="" className="ps-logo" />
          <p>OptiLitige · Fiche dossier</p>
        </div>
        <div className="ps-meta">
          <b>{r.ref}</b>
          <span>
            Éditée le {dateTime(new Date().toISOString())} par {me?.name}
          </span>
        </div>
      </header>
      <h1>{r.title}</h1>
      <p className="ps-status">
        Statut : <b>{r.status}</b> · Origine : {r.origin}
        {r.priority === 'Haute' ? ' · Priorité haute' : ''}
      </p>

      <section className="ps-grid">
        <div>
          <h2>Dossier</h2>
          <Row label="Ouvert le" value={day(r.created)} />
          <Row label="Clôturé le" value={r.closed ? day(r.closed) : ''} />
          <Row label="Réouvertures" value={(r.reopened || []).map(day).join(', ')} />
          <Row
            label="Importé le"
            value={
              imported
                ? dateTime(imported.date) + (imported.file ? ' (' + imported.file + ')' : '')
                : ''
            }
          />
          <Row label="Type à l’ouverture" value={r.type} />
          <Row label="Créé par" value={name(r.creator)} />
          <Row label="Agent litige" value={r.assignee ? name(r.assignee) : 'Non attribué'} />
          <Row label="Demandeur" value={r.requester} />
        </div>
        <div>
          <h2>Commande et produit</h2>
          <Row label="Client" value={r.customer} />
          <Row label="Commande" value={r.order} />
          <Row label="Montant concerné par le litige" value={money(stakeOf(r))} />
          <Row label="Enseigne" value={r.brand} />
          <Row label="Type de produit" value={r.productType} />
          <Row label="Référence produit" value={r.productRef} />
          <Row label="N° de ticket" value={r.ticket} />
          <Row label="BT" value={r.bt} />
          <Row label="N° de facture" value={r.invoice} />
        </div>
        <div>
          <h2>Transporteur</h2>
          <Row label="Transporteur" value={r.carrier} />
          <Row label="Réf. réclamation" value={r.carrierCaseRef} />
          <Row label="État" value={r.carrierStatus} />
          <Row label="Transmis le" value={r.carrierSentAt ? day(r.carrierSentAt) : ''} />
          <Row
            label="Réponse attendue"
            value={r.carrierResponseDue ? day(r.carrierResponseDue) : ''}
          />
          <Row label="Réponse reçue le" value={r.carrierReplyAt ? day(r.carrierReplyAt) : ''} />
          <Row label="Indemnisation" value={r.compensation ? money(r.compensation) : ''} />
          <Row label="État indemnisation" value={r.compensationState} />
        </div>
        <div>
          <h2>Résultat</h2>
          <Row label="Résultat du litige" value={r.outcome} />
          <Row label="Qualification" value={r.resolution?.verdict} />
          <Row label="Motif" value={r.resolution?.reason} />
          <Row label="Solution" value={r.solution} />
          <Row label="N° d’avoir" value={r.creditNumber} />
          <Row label="Montant de l’avoir" value={r.creditIssued ? money(r.credit) : ''} />
          <Row label="Avoir émis le" value={r.creditCreated ? day(r.creditCreated) : ''} />
          <Row label="Étape côté client" value={r.clientStage} />
        </div>
      </section>

      {r.description && (
        <section>
          <h2>Description du signalement</h2>
          <p className="ps-text">{r.description}</p>
        </section>
      )}

      {(r.credits || []).length > 0 && (
        <section>
          <h2>Avoirs</h2>
          <table className="ps-table">
            <tbody>
              {r.credits!.map((c) => (
                <tr key={c.id}>
                  <td>{dateTime(c.requestedAt)}</td>
                  <td>
                    {(CREDIT_FAMILIES as Record<string, string>)[c.family]} · {c.reason} ·
                    imputation {c.imputation}
                    {c.issue ? ' · n° ' + c.issue.number : ''}
                  </td>
                  <td>{money(c.approvedAmount ?? c.amount)}</td>
                  <td>{(CREDIT_STATUSES as Record<string, string>)[c.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(r.transportMessages || []).length > 0 && (
        <section>
          <h2>Échanges avec le transporteur</h2>
          {r.transportMessages!.map((m) => (
            <div className="ps-entry" key={m.id}>
              <b>
                {m.kind} · {m.subject}
              </b>
              <small>
                {m.contact} · échange du {dateTime(m.date)} · consigné par {m.author}
              </small>
              <p className="ps-text">{m.body}</p>
            </div>
          ))}
        </section>
      )}

      {(r.comments || []).length > 0 && (
        <section>
          <h2>Échanges internes</h2>
          {r.comments.map((c) => (
            <div className="ps-entry" key={c.id}>
              <small>
                {c.author} · le {dateTime(c.date)}
              </small>
              <p className="ps-text">{c.text}</p>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2>Chronologie</h2>
        <table className="ps-table">
          <tbody>
            {(r.history || []).map((h, i: number) => (
              <tr key={i}>
                <td>{h.author === 'Migration' ? day(h.date) : dateTime(h.date)}</td>
                <td>{h.text}</td>
                <td>{h.author}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {attachments.length > 0 && (
        <section>
          <h2>Pièces jointes ({attachments.length})</h2>
          <ul className="ps-files">
            {attachments.map((a) => (
              <li key={a.id}>
                {a.name} · {formatSize(a.size)} · ajoutée par {a.author} le {dateTime(a.date)}
              </li>
            ))}
          </ul>
          {photos.length > 0 && (
            <div className="ps-photos">
              {photos.map((a) => (
                <figure key={a.id}>
                  <img src={url(a)} alt={a.name} />
                  <figcaption>{a.name}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}
    </div>,
    document.body,
  );
}
