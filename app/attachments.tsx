'use client';
import { useRef, useState } from 'react';
import { dateTime } from './datetime.mjs';
import {
  Camera,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Upload,
  Webcam,
} from 'lucide-react';
import WebcamCapture from './webcam-capture';
import { useConfirm } from './confirm-dialog';
import { namePhotos, sendAttachment } from './attachment-upload';
import {
  ACCEPT_ATTRIBUTE,
  canDeleteAttachment,
  checkAttachment,
  contentTypeOf,
  formatSize,
  isInline,
} from './attachment-rules.mjs';
import type { Attachment, Member } from './types';

interface AttachmentsProps {
  record: { id: string; ref: string; attachments?: Attachment[] };
  member: Member;
  /** Pièces d'un contentieux (espace des responsables) plutôt que d'un dossier litige */
  contentieux?: boolean;
  demo: boolean;
  onChanged: (message: string) => Promise<unknown>;
}

// Onglet « Pièces jointes » d'un dossier (ou d'un contentieux) : liste, ajout (bouton ou
// glisser-déposer), téléchargement et suppression. `onChanged` recharge après chaque modification.
export default function Attachments({
  record,
  member,
  demo,
  onChanged,
  contentieux = false,
}: AttachmentsProps) {
  const [progress, setProgress] = useState(''),
    [errors, setErrors] = useState<string[]>([]),
    [dragging, setDragging] = useState(false),
    [webcam, setWebcam] = useState(false),
    input = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  const { ask, dialog } = useConfirm();
  const list: Attachment[] = record.attachments || [];
  const busy = !!progress;
  const url = (a: Attachment) =>
    '/api/attachments?id=' +
    encodeURIComponent(record.id) +
    '&att=' +
    encodeURIComponent(a.id) +
    (contentieux ? '&ct=1' : '');

  // Renvoie le nombre de fichiers envoyés
  async function upload(files: File[]): Promise<number> {
    if (demo || busy || !files.length) return 0;
    const problems: string[] = [];
    let count = list.length,
      sent = 0;
    for (const [i, file] of files.entries()) {
      const problem = checkAttachment({ name: file.name, size: file.size }, count);
      if (problem) {
        problems.push(problem);
        continue;
      }
      setProgress('Envoi ' + (i + 1) + ' / ' + files.length + ' : ' + file.name);
      const failure = await sendAttachment(record.id, file, contentieux);
      if (failure) problems.push(failure);
      else {
        count++;
        sent++;
      }
    }
    setProgress('');
    setErrors(problems);
    if (sent)
      await onChanged(sent > 1 ? sent + ' pièces jointes ajoutées' : 'Pièce jointe ajoutée');
    return sent;
  }

  async function remove(a: Attachment) {
    if (
      !(await ask({
        title: 'Supprimer cette pièce jointe ?',
        text: <p>« {a.name} »</p>,
        confirmLabel: 'Supprimer',
      }))
    )
      return;
    setProgress('Suppression…');
    try {
      const res = await fetch('/api/attachments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, att: a.id, ...(contentieux ? { ct: true } : {}) }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setErrors(res.ok ? [] : [d.error || 'Suppression impossible.']);
      if (res.ok) await onChanged('Pièce jointe supprimée');
    } finally {
      setProgress('');
    }
  }

  return (
    <div className="attachments">
      {dialog}
      {webcam && (
        <WebcamCapture
          reference={record.ref}
          busy={busy}
          onCapture={async (file) => (await upload([file])) > 0}
          onClose={() => setWebcam(false)}
        />
      )}
      {demo && (
        <div className="integration-note">
          <Paperclip size={18} />
          <span>
            {contentieux
              ? 'Les pièces jointes sont disponibles dans l’espace réel : elles sont stockées avec le contentieux et visibles par les admins.'
              : 'Les pièces jointes sont disponibles dans l’espace réel : elles sont stockées avec le dossier et visibles par toute l’équipe.'}
          </span>
        </div>
      )}
      {list.length ? (
        <ul className="attachment-list">
          {list.map((a) => {
            const type = contentTypeOf(a.name);
            return (
              <li key={a.id}>
                {isInline(type) ? (
                  <a href={url(a)} target="_blank" rel="noopener" className="attachment-thumb">
                    <img src={url(a)} alt="" loading="lazy" />
                  </a>
                ) : (
                  <span className="attachment-thumb">
                    {type.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
                  </span>
                )}
                <div>
                  <a href={url(a)} target="_blank" rel="noopener">
                    {a.name}
                  </a>
                  <small>
                    {formatSize(a.size)} · ajoutée par {a.author} le {dateTime(a.date)}
                  </small>
                </div>
                {canDeleteAttachment(a, member) && (
                  <button
                    type="button"
                    aria-label={'Supprimer ' + a.name}
                    title="Supprimer"
                    disabled={busy}
                    onClick={() => remove(a)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">
          Aucune pièce jointe pour ce {contentieux ? 'contentieux' : 'dossier'}.
        </p>
      )}
      {!demo && (
        <div
          className={'attachment-drop' + (dragging ? ' dragging' : '')}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload([...e.dataTransfer.files]);
          }}
        >
          <Upload size={18} />
          <span>
            {progress ||
              'Glissez vos fichiers ici : photos, PDF, Word, Excel, e-mails · 15 Mo maximum par fichier'}
          </span>
          {/* Sur téléphone ou tablette : ouvre directement l'appareil photo (caméra arrière) */}
          <button
            type="button"
            className="secondary camera-btn"
            disabled={busy}
            onClick={() => camera.current?.click()}
          >
            <Camera size={15} /> Prendre une photo
          </button>
          {/* Sur ordinateur : webcam intégrée ou caméra branchée en USB */}
          <button
            type="button"
            className="secondary webcam-btn"
            disabled={busy}
            onClick={() => setWebcam(true)}
          >
            <Webcam size={15} /> Webcam
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            Ajouter des fichiers
          </button>
          <input
            ref={camera}
            type="file"
            hidden
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const files = namePhotos([...(e.target.files || [])], record.ref);
              e.target.value = '';
              upload(files);
            }}
          />
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept={ACCEPT_ATTRIBUTE}
            onChange={(e) => {
              const files = [...(e.target.files || [])];
              e.target.value = '';
              upload(files);
            }}
          />
        </div>
      )}
      {errors.length > 0 && (
        <div role="alert" className="error">
          <span>
            {errors.map((m, i) => (
              <span key={i} style={{ display: 'block' }}>
                {m}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
