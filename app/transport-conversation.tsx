'use client';
import { useMemo, useState } from 'react';
import { Check, Copy, Mail, RotateCcw, Save, Settings2 } from 'lucide-react';
import { dateTime } from './datetime.mjs';
import {
  DEFAULT_CLAIM_TEMPLATES,
  fillTemplate,
  placeholderValues,
  suggestTemplate,
} from './claim-templates.mjs';
import { TemplateEditor, copyText, type ClaimTemplate } from './claim-templates';
import { composeHtml, composeText, pickSignature } from './mail-signatures.mjs';
import type { Dossier, MailSignature, Member } from './types';

// Élément saisi dans le formulaire (brouillon ou échange consigné à la main)
export interface TransportDraft {
  kind: string;
  contact: string;
  subject: string;
  body: string;
  date: string;
}

const RECEIVED = 'E-mail reçu (saisi manuellement)';

interface TransportConversationProps {
  record: Dossier;
  me: Member;
  canEdit: boolean;
  busy: boolean;
  onSave: (message: TransportDraft) => Promise<boolean>;
  /** Modèles de réclamation (réglage partagé) et leur enregistrement */
  templates: ClaimTemplate[];
  onSaveTemplates: (templates: ClaimTemplate[]) => Promise<boolean>;
  /** Signatures réglées par les admins (Paramètres → Signatures d’e-mail) */
  signatures: MailSignature[];
  // Transmis par l’écran du dossier, pas encore utilisés (connexion Outlook en attente)
  mailbox?: string;
  connected?: boolean;
}

// Onglet Transporteur : un seul cadre pour écrire l'e-mail (commercial transporteur ou interne).
// Le modèle choisi remplit directement l'objet et le message, modifiables avant l'envoi.
export default function TransportConversation({
  record,
  me,
  canEdit,
  busy,
  onSave,
  templates,
  onSaveTemplates,
  signatures,
}: TransportConversationProps) {
  const list = templates.length ? templates : (DEFAULT_CLAIM_TEMPLATES as ClaimTemplate[]);
  const values = useMemo(() => placeholderValues(record, me), [record, me]);
  // L'objet garde la référence du dossier : elle permettra de rattacher les réponses
  const withRef = (s: string) => (s.includes(record.ref) ? s : '[' + record.ref + '] ' + s);
  const fromTemplate = (id: string) => {
    const t = list.find((x) => x.id === id);
    return t
      ? { subject: withRef(fillTemplate(t.subject, values)), body: fillTemplate(t.body, values) }
      : { subject: '[' + record.ref + '] ' + record.title, body: '' };
  };
  const [templateId, setTemplateId] = useState(() => suggestTemplate(list, record)?.id || '');
  const [f, setF] = useState<TransportDraft>(() => ({
    kind: 'Brouillon',
    contact: '',
    ...fromTemplate(templateId),
    date: new Date().toISOString().slice(0, 16),
  }));
  const [copied, setCopied] = useState('');
  const [signatureId, setSignatureId] = useState(() => pickSignature(signatures, record)?.id || '');
  const signature = signatures.find((x) => x.id === signatureId) || null;
  const [manage, setManage] = useState(false);

  const choose = (id: string) => {
    setTemplateId(id);
    setF({ ...f, ...fromTemplate(id) });
  };
  const copy = async (what: string, text: string) => {
    if (await copyText(text)) {
      setCopied(what);
      window.setTimeout(() => setCopied(''), 1500);
    }
  };
  // Copie du message avec sa signature : HTML (logo) pour Outlook, texte simple en secours
  const copyMessage = async () => {
    const text = composeText(f.body, signature, values);
    let ok = false;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([composeHtml(f.body, signature, values)], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      ok = true;
    } catch {
      ok = await copyText(text);
    }
    if (ok) {
      setCopied('texte');
      window.setTimeout(() => setCopied(''), 1500);
    }
  };
  const received = f.kind === RECEIVED;
  const missing = !received && (f.subject + f.body).includes('[à compléter');
  const validContact = /^\S+@\S+\.\S+$/.test(f.contact);
  const mailto =
    'mailto:' +
    encodeURIComponent(f.contact) +
    '?subject=' +
    encodeURIComponent(f.subject) +
    '&body=' +
    encodeURIComponent(composeText(f.body, signature, values));

  if (manage)
    return (
      <div className="transport-thread">
        <TemplateEditor
          templates={list}
          busy={busy}
          onCancel={() => setManage(false)}
          onSave={async (next) => {
            if (await onSaveTemplates(next)) setManage(false);
          }}
        />
      </div>
    );

  return (
    <div className="transport-thread">
      <div className="integration-note">
        <Mail size={18} />
        <span>
          Connexion Outlook mise en attente. L’envoi et la réception automatiques ne sont pas
          activés. Préparez l’e-mail ici, ouvrez-le dans votre messagerie, puis consignez-le dans le
          dossier ; une réponse reçue se consigne de la même façon.
        </span>
      </div>
      {(record.transportMessages || []).length ? (
        (record.transportMessages || []).map((m) => (
          <article className="external-message" key={m.id}>
            <span className="service-pill">{m.kind}</span>
            <h3>{m.subject}</h3>
            <small>
              {m.contact} · échange du {dateTime(m.date)}
            </small>
            <p>{m.body}</p>
            <small>
              Consigné par {m.author} le {dateTime(m.recorded)}
            </small>
          </article>
        ))
      ) : (
        <p className="muted">Aucun échange transporteur enregistré.</p>
      )}
      {canEdit && (
        <form
          className="transport-compose"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await onSave({
                ...f,
                body: received ? f.body : composeText(f.body, signature, values),
                date: new Date(
                  String(new FormData(e.currentTarget).get('date') || f.date),
                ).toISOString(),
              })
            )
              setF({ ...f, body: '' });
          }}
        >
          <div className="transport-compose-head">
            <h3>Écrire un e-mail</h3>
            <button type="button" className="text-btn" onClick={() => setManage(true)}>
              <Settings2 size={14} /> Gérer les modèles
            </button>
          </div>
          <label>
            Nature de l’élément
            <select
              value={f.kind}
              onChange={(e) => {
                const kind = e.target.value;
                // Réponse reçue : on repart d'un message vide plutôt que du modèle
                if (kind === RECEIVED && !received)
                  setF({ ...f, kind, subject: '[' + record.ref + '] ' + record.title, body: '' });
                else setF({ ...f, kind });
              }}
            >
              <option>Brouillon</option>
              <option>E-mail envoyé (saisi manuellement)</option>
              <option>{RECEIVED}</option>
            </select>
          </label>
          {!received && (
            <label>
              Modèle
              <select value={templateId} onChange={(e) => choose(e.target.value)}>
                <option value="">Message libre (sans modèle)</option>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {received ? 'Expéditeur' : 'Destinataire'} — commercial transporteur ou adresse interne
            <input
              type="email"
              required
              value={f.contact}
              onChange={(e) => setF({ ...f, contact: e.target.value })}
            />
          </label>
          <label>
            Objet
            <input
              required
              maxLength={300}
              value={f.subject}
              onChange={(e) => setF({ ...f, subject: e.target.value })}
            />
          </label>
          <label>
            Date de l’échange
            <input
              name="date"
              type="datetime-local"
              required
              value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })}
            />
          </label>
          <label>
            Message
            <textarea
              required
              maxLength={15000}
              rows={12}
              value={f.body}
              onChange={(e) => setF({ ...f, body: e.target.value })}
            />
          </label>
          {!received && (
            <div className="transport-signature">
              <label>
                Signature
                <select value={signatureId} onChange={(e) => setSignatureId(e.target.value)}>
                  <option value="">Sans signature</option>
                  {signatures.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              {signature && (
                <div className="transport-signature-preview" aria-label="Aperçu de la signature">
                  <p>{composeText('', signature, values).trim()}</p>
                  {signature.logo && (
                    <img
                      src={signature.logo}
                      alt={'Logo ' + signature.name}
                      style={{ width: signature.logoWidth, maxWidth: '100%' }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
          {missing && (
            <p className="claim-missing">
              Certains champs sont à compléter (entre crochets) : remplacez-les avant l’envoi.
            </p>
          )}
          <div className="claim-actions">
            <button disabled={busy} className="primary small-btn">
              <Save size={14} />
              {f.kind === 'Brouillon' ? 'Enregistrer le brouillon' : 'Consigner l’échange'}
            </button>
            {!received && (
              <>
                {validContact ? (
                  <a className="secondary small-btn" href={mailto}>
                    <Mail size={14} /> Ouvrir dans ma messagerie
                  </a>
                ) : null}
                <button
                  type="button"
                  className="secondary small-btn"
                  onClick={() => copy('objet', f.subject)}
                >
                  {copied === 'objet' ? <Check size={14} /> : <Copy size={14} />} Copier l’objet
                </button>
                <button type="button" className="secondary small-btn" onClick={copyMessage}>
                  {copied === 'texte' ? <Check size={14} /> : <Copy size={14} />} Copier le message
                  et la signature
                </button>
                {templateId && (
                  <button type="button" className="text-btn" onClick={() => choose(templateId)}>
                    <RotateCcw size={14} /> Recharger le modèle
                  </button>
                )}
              </>
            )}
          </div>
          <p className="muted">
            Les boutons enregistrent le contenu dans le dossier ou ouvrent votre messagerie :
            l’outil n’envoie aucun e-mail lui-même. Gardez la référence {record.ref} dans l’objet.
          </p>
        </form>
      )}
    </div>
  );
}
