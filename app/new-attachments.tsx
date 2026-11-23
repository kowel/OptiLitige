'use client';
import { useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon, Paperclip, Upload, Webcam, X } from 'lucide-react';
import WebcamCapture from './webcam-capture';
import { namePhotos } from './attachment-upload';
import {
  ACCEPT_ATTRIBUTE,
  MAX_ATTACHMENTS_PER_RECORD,
  checkAttachment,
  contentTypeOf,
  formatSize,
} from './attachment-rules.mjs';

interface NewAttachmentsProps {
  files: File[];
  onChange: (files: File[]) => void;
  demo: boolean;
}

// Pièces jointes choisies dans le formulaire « Ouvrir un nouveau litige ». Les fichiers restent
// dans le navigateur et sont envoyés juste après la création du dossier (app/page.tsx).
export default function NewAttachments({ files, onChange, demo }: NewAttachmentsProps) {
  const [errors, setErrors] = useState<string[]>([]),
    [dragging, setDragging] = useState(false),
    [webcam, setWebcam] = useState(false),
    input = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);

  function add(list: File[]) {
    const problems: string[] = [];
    const kept = [...files];
    for (const file of list) {
      const problem = checkAttachment({ name: file.name, size: file.size }, kept.length);
      if (problem) problems.push(problem);
      else kept.push(file);
    }
    setErrors(problems);
    onChange(kept);
    return kept.length > files.length;
  }

  return (
    <div className="span2 new-attachments">
      <span className="field-label">
        <Paperclip size={14} /> Pièces jointes
        <small> · photos, PDF, e-mails… 15 Mo maximum par fichier</small>
      </span>
      {webcam && (
        <WebcamCapture
          reference=""
          busy={false}
          onCapture={async (file) => add([file])}
          onClose={() => setWebcam(false)}
        />
      )}
      {files.length > 0 && (
        <ul className="attachment-list compact">
          {files.map((f, i) => (
            <li key={f.name + i}>
              <span className="attachment-thumb">
                {contentTypeOf(f.name).startsWith('image/') ? (
                  <ImageIcon size={18} />
                ) : (
                  <FileText size={18} />
                )}
              </span>
              <div>
                <span className="attachment-name">{f.name}</span>
                <small>{formatSize(f.size)}</small>
              </div>
              <button
                type="button"
                aria-label={'Retirer ' + f.name}
                title="Retirer"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
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
          add([...e.dataTransfer.files]);
        }}
      >
        <Upload size={18} />
        <span>
          {demo
            ? 'Démonstration : les fichiers sont listés mais pas conservés.'
            : files.length >= MAX_ATTACHMENTS_PER_RECORD
              ? 'Nombre maximal de pièces jointes atteint.'
              : 'Glissez vos fichiers ici, ils seront joints au dossier à sa création.'}
        </span>
        <button
          type="button"
          className="secondary camera-btn"
          onClick={() => camera.current?.click()}
        >
          <Camera size={15} /> Prendre une photo
        </button>
        <button type="button" className="secondary webcam-btn" onClick={() => setWebcam(true)}>
          <Webcam size={15} /> Webcam
        </button>
        <button type="button" className="secondary" onClick={() => input.current?.click()}>
          Ajouter des fichiers
        </button>
        <input
          ref={camera}
          type="file"
          hidden
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const list = namePhotos([...(e.target.files || [])]);
            e.target.value = '';
            add(list);
          }}
        />
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={ACCEPT_ATTRIBUTE}
          onChange={(e) => {
            const list = [...(e.target.files || [])];
            e.target.value = '';
            add(list);
          }}
        />
      </div>
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
