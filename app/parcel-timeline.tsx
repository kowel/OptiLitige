'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  MapPin,
  PackageCheck,
  PackageSearch,
  RefreshCw,
} from 'lucide-react';
import { trackingLinksFor } from './parcel-tracking.mjs';
import { STEPS, demoTracking, providerFor, PROVIDERS } from './tracking-providers.mjs';
import type { Dossier } from './types';

interface TrackEvent {
  date: string;
  label: string;
  place?: string;
}
interface TrackResult {
  status: 'ok' | 'not-configured' | 'not-found' | 'error' | 'unsupported';
  message?: string;
  label?: string;
  delivered?: boolean;
  deliveredAt?: string;
  step?: number;
  events?: TrackEvent[];
  demo?: boolean;
  /** Suivi lu sur Welcometrack (tous transporteurs) */
  via?: string;
  /** Incident signalé par Welcometrack (avarie, retour, adresse…) */
  issue?: string;
}
interface TrackItem {
  number: string;
  carrier: string;
  url: string;
  provider?: string;
  result?: TrackResult;
  fetchedAt?: string;
  stale?: boolean;
}

const KEY = 'optilitige-suivi-colis-replie';

// Suivi lu sur le serveur (/api/tracking) ; en cas d'échec, chaque numéro affiche une erreur
async function fetchTracking(id: string, base: TrackItem[], refresh = false): Promise<TrackItem[]> {
  try {
    const res = await fetch(
      '/api/tracking?id=' + encodeURIComponent(id) + (refresh ? '&refresh=1' : ''),
    );
    const json = (await res.json()) as { items?: TrackItem[] };
    return json.items || [];
  } catch {
    return base.map((b) => ({ ...b, result: { status: 'error', message: 'Suivi indisponible.' } }));
  }
}
const when = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(d);
};
const ago = (iso?: string) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1
    ? 'à l’instant'
    : m < 60
      ? 'il y a ' + m + ' min'
      : 'il y a ' + Math.round(m / 60) + ' h';
};

// Panneau « Suivi du colis » en haut de la fiche : frise des étapes et historique détaillé lus
// sur l'API du transporteur (/api/tracking), sans quitter OptiLitige.
export default function ParcelTimeline({
  record,
  links,
  demo,
  admin,
}: {
  record: Dossier;
  links: Record<string, string>;
  demo: boolean;
  admin: boolean;
}) {
  const base = trackingLinksFor(record, links) as TrackItem[];
  const numbersKey = base.map((b) => b.number).join(',');
  const [items, setItems] = useState<TrackItem[] | null>(null);
  const [tab, setTab] = useState(0);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [folded, setFolded] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  // Démonstration : suivi simulé, calculé directement (aucun appel)
  const [demoItems] = useState<TrackItem[] | null>(() =>
    demo
      ? base.map((b) => ({
          ...b,
          provider: providerFor(b.carrier),
          result: demoTracking(b.number, record.created) as TrackResult,
          fetchedAt: new Date().toISOString(),
        }))
      : null,
  );
  const load = (refresh = false) => fetchTracking(record.id, base, refresh).then(setItems);

  // Le panneau est recréé pour chaque dossier (key = id) : lecture du suivi à l'ouverture
  useEffect(() => {
    if (!numbersKey || demo) return;
    let alive = true;
    fetchTracking(record.id, base).then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, numbersKey, demo]);

  if (!base.length) return null;
  const loading = !demoItems && !items;
  const list = demoItems || items || base;
  const item = list[Math.min(tab, list.length - 1)];
  const r = item.result;
  const events = r?.events || [];
  const shown = all ? events : events.slice(0, 5);
  const fold = (v: boolean) => {
    setFolded(v);
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      // préférence seulement pour cet onglet
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // presse-papiers indisponible
    }
  };
  const providerLabel = (PROVIDERS as Record<string, { label: string }>)[item.provider || '']
    ?.label;

  return (
    <section
      className={'panel parcel-panel' + (folded ? ' folded' : '')}
      aria-label="Suivi du colis"
    >
      <div className="panel-heading parcel-panel-heading">
        <h2>
          <PackageSearch size={17} /> Suivi du colis
          {r?.status === 'ok' && (
            <span className={'parcel-pill ' + (r.delivered ? 'done' : 'moving')}>
              {r.delivered ? 'Livré' : 'En cours'}
            </span>
          )}
        </h2>
        <span className="panel-heading-actions">
          {!folded && r?.status === 'ok' && (
            <small className="parcel-updated">
              {r.demo ? 'Exemple (démonstration)' : 'Mis à jour ' + ago(item.fetchedAt)}
              {r.via === 'welcometrack' ? ' · via Welcometrack' : ''}
              {item.stale ? ' · transporteur injoignable, dernier suivi connu' : ''}
            </small>
          )}
          {!folded && item.provider && !demo && (
            <button
              type="button"
              className="secondary small-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await load(true);
                setBusy(false);
              }}
              title="Interroger à nouveau le transporteur"
            >
              <RefreshCw size={14} className={busy ? 'spin' : ''} /> Actualiser
            </button>
          )}
          <button
            type="button"
            className="text-btn"
            onClick={() => fold(!folded)}
            aria-expanded={!folded}
          >
            {folded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            {folded ? 'Afficher' : 'Masquer'}
          </button>
        </span>
      </div>
      {!folded && (
        <div className="parcel-panel-body">
          {list.length > 1 && (
            <div className="parcel-tabs" role="tablist">
              {list.map((t, i) => (
                <button
                  key={t.number}
                  type="button"
                  role="tab"
                  aria-selected={i === tab}
                  className={i === tab ? 'active' : ''}
                  onClick={() => {
                    setTab(i);
                    setAll(false);
                  }}
                >
                  {t.carrier || 'Colis'} · {t.number}
                </button>
              ))}
            </div>
          )}
          <div className="parcel-id">
            <span>
              {item.carrier || 'Transporteur ?'} · <code>{item.number}</code>
            </span>
            <span className="parcel-actions">
              <button type="button" className="secondary small-btn" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copié' : 'Copier'}
              </button>
              {item.url && (
                <a className="secondary small-btn" href={item.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Page du transporteur
                </a>
              )}
            </span>
          </div>

          {loading && <p className="parcel-note">Interrogation du transporteur…</p>}

          {r?.status === 'ok' && (
            <>
              <ol className="parcel-steps">
                {STEPS.map((label, i) => (
                  <li
                    key={label}
                    className={
                      (r.step || 0) > i ? 'done' : (r.step || 0) === i ? 'next' : undefined
                    }
                  >
                    <span className="dot">{(r.step || 0) > i ? <Check size={11} /> : null}</span>
                    <small>{label}</small>
                  </li>
                ))}
              </ol>
              <div className={'parcel-now' + (r.delivered ? ' done' : '')}>
                {r.delivered ? <PackageCheck size={18} /> : <PackageSearch size={18} />}
                <div>
                  <b>{r.label || (r.delivered ? 'Colis livré' : 'Colis en cours')}</b>
                  {r.delivered && r.deliveredAt && <small>Livré {when(r.deliveredAt)}</small>}
                </div>
              </div>
              {r.issue && <p className="parcel-note warn">Signalé par Welcometrack : {r.issue}</p>}
              {events.length > 0 && (
                <ul className="parcel-events">
                  {shown.map((e, i) => (
                    <li key={i + e.date}>
                      <time>{when(e.date)}</time>
                      <span>
                        {e.label}
                        {e.place && (
                          <small>
                            <MapPin size={11} /> {e.place}
                          </small>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {events.length > 5 && (
                <button type="button" className="text-btn" onClick={() => setAll(!all)}>
                  {all ? 'Voir moins' : 'Voir les ' + events.length + ' événements'}
                </button>
              )}
            </>
          )}

          {r?.status === 'not-configured' && (
            <p className="parcel-note">
              Le suivi détaillé {providerLabel ? 'par ' + providerLabel : ''} s’affichera ici dès
              que la clé Welcometrack sera enregistrée
              {admin ? ' (Paramètres → Transporteurs → API de suivi des colis)' : ' par un admin'}.
              En attendant : « Page du transporteur ».
            </p>
          )}
          {r?.status === 'unsupported' && (
            <p className="parcel-note">
              Pas de suivi détaillé disponible pour {item.carrier || 'ce transporteur'} : utilisez «
              Page du transporteur »
              {!item.url && admin
                ? ' (lien à ajouter dans Paramètres → Liens de suivi des colis)'
                : ''}
              .
            </p>
          )}
          {(r?.status === 'not-found' || r?.status === 'error') && (
            <div className="parcel-note warn parcel-fallback">
              <span>
                <b>Pas de suivi Welcometrack, aller sur le site du transporteur.</b>
                {r.status === 'error' && r.message ? ' (' + r.message + ')' : ''}
                {!item.url &&
                  (admin
                    ? ' Adresse de suivi de ' +
                      (item.carrier || 'ce transporteur') +
                      ' à ajouter dans Paramètres → Transporteurs → Liens de suivi des colis.'
                    : ' Copiez le numéro et recherchez-le sur le site du transporteur.')}
              </span>
              {item.url && (
                <a className="primary small-btn" href={item.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Suivre sur le site {item.carrier || 'du transporteur'}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
