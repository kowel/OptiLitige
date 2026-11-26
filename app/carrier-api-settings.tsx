'use client';
import { useState } from 'react';
import { Check, PlugZap, Trash2 } from 'lucide-react';
import { API_FIELDS, PROVIDERS } from './tracking-providers.mjs';
import type { CarrierApiStatus } from './types';

// Paramètres → Transporteurs → API de suivi des colis : les admins branchent la clé Welcometrack
// (suivi de tous les transporteurs). La clé est envoyée au serveur et n'en repart jamais :
// l'écran n'affiche que « connecté » et ses 4 derniers caractères.
const HELP: Record<string, string> = {
  laposte:
    'En secours, quand Welcometrack ne trouve pas un colis Colissimo ou Chronopost. Clé gratuite sur developer.laposte.fr (API « Suivi v2 »).',
  fedex:
    'En secours, quand Welcometrack ne trouve pas un colis FedEx ou TNT. Compte développeur FedEx (developer.fedex.com), projet avec l’API « Track ».',
  welcometrack:
    'Clé API Welcometrack (v6), utilisée en lecture seule : suivi de tous les colis déclarés par Cybertek, quel que soit le transporteur (Colissimo, Chronopost, TNT, FedEx, GEODIS, France Express, Kuehne+Nagel…), et nombre d’expéditions (Paramètres → Expéditions).',
};

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    message?: string;
  };
  if (!res.ok) throw new Error(d.error || 'Erreur du serveur. Réessayez.');
  return d;
}

const day = (v: string) =>
  v ? new Date(v).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) : '';

function ProviderCard({
  provider,
  status,
  demo,
  onChanged,
}: {
  provider: string;
  status?: CarrierApiStatus;
  demo: boolean;
  onChanged: () => unknown;
}) {
  const fields = API_FIELDS[provider as keyof typeof API_FIELDS];
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const filled = fields.every((f) => (values[f.name] || '').trim());
  const run = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    setNote(null);
    try {
      const d = await post({ ...body, provider });
      if (body.action === 'carrier-api-test') setNote({ ok: !!d.ok, text: d.message || '' });
      else {
        setValues({});
        setNote({ ok: true, text: done || 'Enregistré.' });
        await onChanged();
      }
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="carrier-api">
      <h3>
        {PROVIDERS[provider as keyof typeof PROVIDERS]?.label || provider}{' '}
        <span className={'carrier-api-state ' + (status?.configured ? 'on' : 'off')}>
          {status?.configured ? 'Connecté' : 'Non connecté'}
        </span>
      </h3>
      <p className="muted">
        {status?.source === 'outil'
          ? 'Clé ' +
            status.hint +
            ', enregistrée par ' +
            (status.savedBy || 'un admin') +
            (status.savedAt ? ' le ' + day(status.savedAt) : '') +
            '.'
          : status?.source === 'serveur'
            ? 'Réglée par l’informatique sur le serveur. Une clé saisie ici la remplace.'
            : HELP[provider]}
      </p>
      {status?.source !== '' && status?.source && <p className="muted small">{HELP[provider]}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run({ action: 'carrier-api-keys', values }, 'Connexion enregistrée.');
        }}
      >
        {fields.map((f) => (
          <label key={f.name}>
            {f.label}
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={values[f.name] || ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              disabled={demo}
            />
          </label>
        ))}
        <div className="carrier-api-actions">
          <button
            type="button"
            className="secondary"
            disabled={demo || busy || (!filled && !status?.configured)}
            onClick={() => run({ action: 'carrier-api-test', ...(filled ? { values } : {}) })}
          >
            <PlugZap size={16} /> Tester la connexion
          </button>
          <button className="primary" disabled={demo || busy || !filled}>
            <Check size={16} /> Enregistrer
          </button>
          {status?.source === 'outil' && (
            <button
              type="button"
              className="text-btn danger"
              disabled={demo || busy}
              onClick={() => {
                if (window.confirm('Retirer la clé ' + (status.label || provider) + ' ?'))
                  run({ action: 'carrier-api-remove' }, 'Clé retirée.');
              }}
            >
              <Trash2 size={16} /> Retirer
            </button>
          )}
        </div>
        {note && (
          <p className={'carrier-api-note ' + (note.ok ? 'ok' : 'error')} role="status">
            {note.text}
          </p>
        )}
      </form>
    </div>
  );
}

export default function CarrierApiSettings({
  status,
  demo,
  onChanged,
}: {
  status: Record<string, CarrierApiStatus>;
  demo: boolean;
  onChanged: () => unknown;
}) {
  return (
    <section className="panel settings-panel carrier-api-settings">
      <div className="integration-icon">
        <PlugZap size={24} />
      </div>
      <h2>Suivi des colis : Welcometrack et secours</h2>
      <p>
        Le suivi détaillé des colis de chaque dossier (étapes, événements, date de livraison,
        incidents) vient de Welcometrack, pour tous les transporteurs. Si Welcometrack ne trouve pas
        un colis, La Poste (Colissimo, Chronopost) et FedEx (FedEx, TNT) prennent le relais quand
        leur clé est réglée ; sinon la fiche renvoie vers le site du transporteur. Les clés restent
        sur le serveur : elles ne sont plus jamais affichées après l’enregistrement.
      </p>
      <p className="carrier-api-scope">
        <strong>Uniquement pour le suivi des colis.</strong> Ces connexions ne relient pas le compte
        client du transporteur et ne permettent pas d’échanger avec son service client : les
        réclamations et les réponses se font par e-mail (onglet Transporteur du dossier).
      </p>
      {demo && (
        <p className="muted">En démonstration, les connexions ne peuvent pas être réglées.</p>
      )}
      {Object.keys(API_FIELDS).map((p) => (
        <ProviderCard
          key={p + (status[p]?.savedAt || '') + (status[p]?.source || '')}
          provider={p}
          status={status[p]}
          demo={demo}
          onChanged={onChanged}
        />
      ))}
    </section>
  );
}
