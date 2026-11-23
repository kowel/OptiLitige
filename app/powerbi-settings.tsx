'use client';
import { useState } from 'react';
import { BarChart3, Copy, KeyRound, Trash2 } from 'lucide-react';
import type { PowerBiStatus } from './types';

// Paramètres → Power BI : les responsables créent le jeton qui permet à Power BI de lire les
// données des litiges (GET /api/powerbi), et copient la requête à coller dans Power BI.
// Le jeton n'est montré qu'une fois ; l'outil n'en garde que l'empreinte.
async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
  if (!res.ok) throw new Error(d.error || 'Erreur du serveur. Réessayez.');
  return d;
}

const when = (v: string) =>
  v
    ? new Date(v).toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '';

// Requête Power Query (Obtenir des données → Requête vide → Éditeur avancé)
export function powerQuery(origin: string, table: string, token: string) {
  return [
    'let',
    '    Source = Json.Document(Web.Contents("' + origin + '", [',
    '        RelativePath = "api/powerbi",',
    '        Query = [table = "' + table + '"],',
    '        Headers = [',
    '            Authorization = "Bearer ' + token + '"',
    '        ]',
    '    ])),',
    '    Table = Table.FromRecords(Source)',
    'in',
    '    Table',
  ].join('\n');
}

export default function PowerBiSettings({
  status,
  demo,
  onChanged,
}: {
  status?: PowerBiStatus;
  demo: boolean;
  onChanged: () => unknown;
}) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const run = async (action: string) => {
    setBusy(true);
    setNote(null);
    try {
      const d = await post({ action });
      setToken(d.token || '');
      setNote({
        ok: true,
        text: d.token
          ? 'Jeton créé. Copiez-le maintenant : il ne sera plus affiché.'
          : 'Connexion Power BI coupée.',
      });
      await onChanged();
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote({ ok: true, text: what + ' copié.' });
    } catch {
      setNote({ ok: false, text: 'Copie impossible : sélectionnez le texte à la main.' });
    }
  };
  return (
    <section className="panel settings-panel powerbi-settings">
      <div className="integration-icon">
        <BarChart3 size={24} />
      </div>
      <h2>Power BI</h2>
      <p>
        Power BI peut lire les données des litiges pour vos tableaux de bord : une ligne par litige
        (dates, statut, type, résultat, imputation, transporteur, décision, délais, indemnisation,
        écart, avoirs) et une ligne par mois et par transporteur pour les expéditions. Lecture
        seule, sans nom ni compte client. Power BI peut actualiser ces données chaque jour.
      </p>
      <p className="muted">
        {status?.active
          ? 'Connexion active : jeton ' +
            status.hint +
            ' créé par ' +
            (status.createdBy || 'un admin') +
            ' le ' +
            when(status.createdAt) +
            (status.lastUsedAt
              ? '. Dernière lecture par Power BI : ' + when(status.lastUsedAt) + '.'
              : '. Pas encore lu par Power BI.')
          : 'Connexion inactive : créez un jeton pour la brancher.'}
      </p>
      {demo && <p className="muted">En démonstration, la connexion ne peut pas être réglée.</p>}
      <div className="carrier-api-actions">
        <button
          type="button"
          className={status?.active ? 'secondary' : 'primary'}
          disabled={demo || busy}
          onClick={() => {
            if (
              !status?.active ||
              window.confirm(
                'Créer un nouveau jeton ? L’ancien cessera de fonctionner : il faudra le remplacer dans Power BI.',
              )
            )
              run('powerbi-token-new');
          }}
        >
          <KeyRound size={16} /> {status?.active ? 'Remplacer le jeton' : 'Créer un jeton'}
        </button>
        {status?.active && (
          <button
            type="button"
            className="text-btn danger"
            disabled={demo || busy}
            onClick={() => {
              if (window.confirm('Couper la connexion Power BI ? Ses actualisations échoueront.'))
                run('powerbi-token-remove');
            }}
          >
            <Trash2 size={16} /> Couper la connexion
          </button>
        )}
      </div>
      {note && (
        <p className={'carrier-api-note ' + (note.ok ? 'ok' : 'error')} role="status">
          {note.text}
        </p>
      )}
      {token && (
        <div className="powerbi-token">
          <code>{token}</code>
          <button type="button" className="secondary" onClick={() => copy(token, 'Jeton')}>
            <Copy size={16} /> Copier le jeton
          </button>
        </div>
      )}
      <details className="powerbi-howto">
        <summary>Brancher Power BI (pas à pas)</summary>
        <ol>
          <li>
            Dans Power BI Desktop : <em>Obtenir des données → Requête vide</em>, puis{' '}
            <em>Éditeur avancé</em>. Collez la requête ci-dessous et remplacez les valeurs entre{' '}
            <code>&lt; &gt;</code>.
          </li>
          <li>
            Faites de même avec <code>table = &quot;expeditions&quot;</code> pour les expéditions
            par mois.
          </li>
          <li>
            Une fois le rapport publié, réglez l’actualisation planifiée (chaque jour) dans le
            service Power BI, avec l’authentification « Anonyme ».
          </li>
        </ol>
        <pre>{powerQuery(origin, 'litiges', token || '<jeton Power BI>')}</pre>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            copy(powerQuery(origin, 'litiges', token || '<jeton Power BI>'), 'Requête')
          }
        >
          <Copy size={16} /> Copier la requête
        </button>
      </details>
    </section>
  );
}
