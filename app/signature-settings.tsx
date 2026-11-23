'use client';
import { useState } from 'react';
import { Check, ImagePlus, PenLine, Plus, Trash2 } from 'lucide-react';
import { LOGO_WIDTHS, MAX_LOGO_BYTES, MAX_SIGNATURES } from './mail-signatures.mjs';
import type { MailSignature } from './types';

interface SignatureSettingsProps {
  signatures: MailSignature[];
  admin: boolean;
  busy: boolean;
  onSave: (signatures: MailSignature[]) => Promise<boolean>;
}

// Paramètres → Signatures d'e-mail : texte, logo en grand et enseignes, réglés par les admins.
// Elles s'ajoutent aux e-mails écrits dans l'onglet Transporteur des dossiers.
export default function SignatureSettings({
  signatures,
  admin,
  busy,
  onSave,
}: SignatureSettingsProps) {
  const [items, setItems] = useState<MailSignature[]>(() => signatures.map((s) => ({ ...s })));
  const [error, setError] = useState('');
  const update = (i: number, patch: Partial<MailSignature>) =>
    setItems(items.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const pickLogo = (i: number, file?: File) => {
    setError('');
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type))
      return setError('Logo : image PNG, JPEG, GIF ou WebP.');
    if (file.size > MAX_LOGO_BYTES)
      return setError('Logo trop lourd : 150 Ko au maximum (réduisez-le, en PNG ou JPEG).');
    const reader = new FileReader();
    reader.onload = () => update(i, { logo: String(reader.result || '') });
    reader.readAsDataURL(file);
  };

  return (
    <section className="panel settings-panel signature-settings">
      <div className="integration-icon">
        <PenLine size={24} />
      </div>
      <h2>Signatures d’e-mail</h2>
      <p>
        Ajoutées aux e-mails écrits dans l’onglet Transporteur des dossiers. « {'{agent}'} » est
        remplacé par le nom de l’agent. La signature d’une enseigne est proposée d’office pour ses
        dossiers. Le logo apparaît en grand quand l’e-mail est copié puis collé dans Outlook.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(items);
        }}
      >
        {items.map((s, i) => (
          <fieldset key={s.id || i} className="signature-item" disabled={!admin}>
            <label>
              Nom
              <input
                required
                maxLength={80}
                value={s.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
            </label>
            <label>
              Enseignes (séparées par des virgules, facultatif)
              <input
                maxLength={400}
                value={s.brands.join(', ')}
                onChange={(e) => update(i, { brands: e.target.value.split(',') })}
                onBlur={(e) =>
                  update(i, {
                    brands: e.target.value
                      .split(',')
                      .map((b) => b.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Texte de la signature
              <textarea
                rows={4}
                maxLength={2000}
                value={s.text}
                onChange={(e) => update(i, { text: e.target.value })}
              />
            </label>
            <div className="signature-logo">
              {s.logo ? (
                <img
                  src={s.logo}
                  alt={'Logo de la signature ' + s.name}
                  style={{ width: s.logoWidth, maxWidth: '100%' }}
                />
              ) : (
                <span className="muted">Pas de logo</span>
              )}
              {admin && (
                <div className="signature-logo-actions">
                  <label className="secondary small-btn signature-upload">
                    <ImagePlus size={14} /> {s.logo ? 'Changer le logo' : 'Ajouter le logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={(e) => {
                        pickLogo(i, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {s.logo && (
                    <>
                      <label className="signature-width">
                        Largeur : {s.logoWidth} px
                        <input
                          type="range"
                          min={LOGO_WIDTHS.min}
                          max={LOGO_WIDTHS.max}
                          step={10}
                          value={s.logoWidth}
                          onChange={(e) => update(i, { logoWidth: Number(e.target.value) })}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => update(i, { logo: '' })}
                      >
                        Retirer le logo
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {admin && items.length > 1 && (
              <button
                type="button"
                className="text-btn danger-text"
                onClick={() => setItems(items.filter((_, k) => k !== i))}
              >
                <Trash2 size={14} /> Supprimer cette signature
              </button>
            )}
          </fieldset>
        ))}
        {error && (
          <p className="claim-missing" role="alert">
            {error}
          </p>
        )}
        {admin ? (
          <div className="claim-actions">
            {items.length < MAX_SIGNATURES && (
              <button
                type="button"
                className="secondary small-btn"
                onClick={() =>
                  setItems([
                    ...items,
                    {
                      id: 'signature-' + Date.now().toString(36),
                      name: 'Nouvelle signature',
                      brands: [],
                      text: 'Cordialement,\n{agent}\n',
                      logo: '',
                      logoWidth: LOGO_WIDTHS.default,
                    },
                  ])
                }
              >
                <Plus size={14} /> Ajouter une signature
              </button>
            )}
            <button className="primary small-btn" disabled={busy}>
              <Check size={14} /> Enregistrer les signatures
            </button>
          </div>
        ) : (
          <p className="muted">Réservé aux admins.</p>
        )}
      </form>
    </section>
  );
}
