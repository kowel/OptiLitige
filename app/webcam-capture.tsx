'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Check, RotateCcw, X } from 'lucide-react';

interface WebcamCaptureProps {
  /** Référence du dossier, pour nommer les photos */
  reference: string;
  busy: boolean;
  /** Envoie la photo comme pièce jointe ; renvoie true si elle a été ajoutée */
  onCapture: (file: File) => Promise<boolean>;
  onClose: () => void;
}

// Prise de photo depuis une webcam ou une caméra branchée à l'ordinateur (atelier SAV,
// poste RC). Le navigateur demande l'autorisation d'utiliser la caméra la première fois.
export default function WebcamCapture({ reference, busy, onCapture, onClose }: WebcamCaptureProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]),
    [deviceId, setDeviceId] = useState(''),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null),
    [added, setAdded] = useState(0);

  // Ouvre la caméra choisie (ou celle par défaut) et l'affiche en direct
  useEffect(() => {
    let cancelled = false;
    async function start() {
      setReady(false);
      setError('');
      stream.current?.getTracks().forEach((t) => t.stop());
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Ce navigateur ne permet pas d’utiliser une caméra.');
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        // La liste des caméras (noms compris) n'est disponible qu'après l'autorisation
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setCameras(all.filter((d) => d.kind === 'videoinput'));
        setReady(true);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'L’accès à la caméra a été refusé. Autorisez-le avec l’icône de caméra dans la barre d’adresse, puis réessayez.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'Aucune caméra détectée. Vérifiez qu’elle est bien branchée.'
              : name === 'NotReadableError'
                ? 'La caméra est déjà utilisée par une autre application (Teams, visio…). Fermez-la puis réessayez.'
                : 'Impossible d’ouvrir la caméra.',
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [deviceId]);

  // Libère l'aperçu de la dernière photo
  useEffect(
    () => () => {
      if (shot) URL.revokeObjectURL(shot.url);
    },
    [shot],
  );

  function takePhoto() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => blob && setShot({ blob, url: URL.createObjectURL(blob) }),
      'image/jpeg',
      0.9,
    );
  }

  async function keep() {
    if (!shot) return;
    const stamp = new Date()
      .toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
      .replace(/\//g, '-')
      .replace(':', 'h');
    const file = new File(
      [shot.blob],
      'Photo ' +
        (reference ? reference + ' ' : '') +
        stamp +
        (added ? ' (' + (added + 1) + ')' : '') +
        '.jpg',
      { type: 'image/jpeg' },
    );
    if (await onCapture(file)) {
      setAdded(added + 1);
      setShot(null);
    }
  }

  return (
    <div
      className="webcam-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Photo depuis la webcam"
    >
      <div className="webcam-box">
        <header>
          <b>
            <Camera size={16} /> Photo depuis la caméra
          </b>
          <button type="button" aria-label="Fermer" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        {cameras.length > 1 && (
          <label className="webcam-select">
            Caméra
            <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">Caméra par défaut</option>
              {cameras.map((c, i) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || 'Caméra ' + (i + 1)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="webcam-stage">
          {/* La vidéo reste montée pendant l'aperçu pour reprendre une photo sans délai */}
          <video ref={video} muted playsInline hidden={!!shot || !!error} />
          {shot && <img src={shot.url} alt="Photo prise" />}
          {error && <p className="webcam-error">{error}</p>}
          {!ready && !error && <p className="muted">Ouverture de la caméra…</p>}
        </div>
        <div className="webcam-actions">
          <small className="muted">
            {added
              ? added + ' photo(s) ajoutée(s) au dossier'
              : 'Cadrez la pièce et l’emballage, puis prenez la photo.'}
          </small>
          {shot ? (
            <>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setShot(null)}
              >
                <RotateCcw size={14} /> Reprendre
              </button>
              <button type="button" className="primary" disabled={busy} onClick={keep}>
                <Check size={14} /> Ajouter au dossier
              </button>
            </>
          ) : (
            <>
              <button type="button" className="secondary" onClick={onClose}>
                {added ? 'Terminer' : 'Annuler'}
              </button>
              <button type="button" className="primary" disabled={!ready} onClick={takePhoto}>
                <Camera size={14} /> Prendre la photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
