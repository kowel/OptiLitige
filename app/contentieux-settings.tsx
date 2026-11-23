'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import ListEditor from './list-editor';
import type { ListSave } from './list-editor';
import type { Contentieux, ContentieuxSettings as Settings } from './types';

// Paramètres → Contentieux (responsables) : les listes de l'espace Contentieux, comme les listes
// des litiges. Types (niveau de risque et délai légal de réponse), sujets, sous-sujets de chaque
// sujet et décisions. Un renommage peut s'appliquer aussi aux contentieux déjà saisis ; une valeur
// retirée reste sur les contentieux qui l'utilisent. Règles : app/contentieux.mjs.

export interface ContentieuxSettingsSave {
  settings: Settings;
  renames: { field: string; from: string; to: string; subject?: string }[];
  applyToRecords: boolean;
}
interface Props {
  settings: Settings;
  items: Contentieux[];
  busy: boolean;
  onSave: (save: ContentieuxSettingsSave) => Promise<boolean>;
}

const count = (
  items: Contentieux[],
  key: keyof Contentieux,
  filter?: (c: Contentieux) => boolean,
) =>
  items.reduce<Record<string, number>>((m, c) => {
    const v = String(c[key] ?? '');
    if (v && (!filter || filter(c))) m[v] = (m[v] || 0) + 1;
    return m;
  }, {});

type KindRow = { original: string | null; id: string; risk: string; days: string };

/** Types de contentieux : nom, niveau de risque (1 à 6) et délai légal de réponse (jours) */
function KindsEditor({ settings, items, busy, onSave }: Props) {
  const start = () =>
    settings.kinds.map(
      (k) => ({ original: k.id, id: k.id, risk: String(k.risk), days: String(k.days) }) as KindRow,
    );
  const [rows, setRows] = useState<KindRow[]>(start);
  const [apply, setApply] = useState(true);
  const usage = count(items, 'kind');
  const set = (i: number, patch: Partial<KindRow>) =>
    setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };
  const renames = rows.filter((r) => r.original && r.id.trim() && r.id.trim() !== r.original);
  const removed = settings.kinds.filter((k) => !rows.some((r) => r.original === k.id));
  return (
    <section className="panel settings-panel list-editor ct-kinds-editor">
      <h3>Types de contentieux</h3>
      <p>
        Niveau de risque de 1 (faible) à 6 (très élevé) et délai légal de réponse en jours : la date
        limite d’un contentieux = date de réception + ce délai. Un délai changé ici vaut pour les
        contentieux enregistrés ensuite.
      </p>
      <ul>
        <li className="ct-kinds-head" aria-hidden="true">
          <span>Type</span>
          <span>Risque</span>
          <span>Délai (j)</span>
        </li>
        {rows.map((r, i) => (
          <li key={(r.original ?? 'new') + i}>
            <input
              aria-label={'Nom du type : ' + r.id}
              value={r.id}
              maxLength={80}
              onChange={(e) => set(i, { id: e.target.value })}
            />
            <select
              aria-label={'Niveau de risque : ' + r.id}
              value={r.risk}
              onChange={(e) => set(i, { risk: e.target.value })}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <input
              aria-label={'Délai légal en jours : ' + r.id}
              type="number"
              min="1"
              max="365"
              value={r.days}
              onChange={(e) => set(i, { days: e.target.value })}
            />
            <small className="list-usage">
              {r.original && usage[r.original] ? usage[r.original] + ' contentieux' : ''}
            </small>
            <button
              type="button"
              aria-label={'Monter ' + r.id}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              aria-label={'Descendre ' + r.id}
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              aria-label={'Supprimer ' + r.id}
              disabled={rows.length === 1}
              onClick={() => setRows(rows.filter((_, k) => k !== i))}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="list-add">
        <button
          type="button"
          className="secondary"
          onClick={() => setRows([...rows, { original: null, id: '', risk: '3', days: '15' }])}
        >
          <Plus size={15} /> Ajouter un type
        </button>
      </div>
      {removed.length > 0 && (
        <p className="list-note">
          Retiré(s) de la liste : {removed.map((k) => k.id).join(', ')}. Les contentieux déjà saisis
          gardent leur type et leur délai.
        </p>
      )}
      {renames.length > 0 && (
        <label className="list-apply">
          <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} />
          Renommer aussi dans les contentieux déjà saisis (
          {renames.map((r) => '« ' + r.original + ' » → « ' + r.id.trim() + ' »').join(', ')})
        </label>
      )}
      <button
        type="button"
        className="primary"
        disabled={busy}
        onClick={async () => {
          const ok = await onSave({
            settings: {
              ...settings,
              kinds: rows.map((r) => ({
                id: r.id.trim(),
                risk: Number(r.risk),
                days: Number(r.days),
              })),
            },
            renames: renames.map((r) => ({ field: 'kind', from: r.original!, to: r.id.trim() })),
            applyToRecords: apply,
          });
          if (ok) setRows(rows.map((r) => ({ ...r, id: r.id.trim(), original: r.id.trim() })));
        }}
      >
        <Check size={16} /> Enregistrer
      </button>
    </section>
  );
}

export default function ContentieuxSettingsPanel({ settings, items, busy, onSave }: Props) {
  const [subject, setSubject] = useState(settings.subjects[0]?.name || '');
  const current = settings.subjects.find((s) => s.name === subject) || settings.subjects[0];
  const save = (patch: Partial<Settings>, field: string, s: ListSave, extra = {}) =>
    onSave({
      settings: { ...settings, ...patch },
      renames: s.renames.map((r) => ({ field, ...r, ...extra })),
      applyToRecords: s.applyToRecords,
    });
  return (
    <div className="overview-grid ct-settings">
      <KindsEditor
        key={'kinds-' + JSON.stringify(settings.kinds)}
        settings={settings}
        items={items}
        busy={busy}
        onSave={onSave}
      />
      <ListEditor
        key={'subjects-' + JSON.stringify(settings.subjects.map((s) => s.name))}
        title="Sujets"
        help="Pourquoi le client fait ce recours, d’un point de vue interne. Chaque sujet a ses propres sous-sujets (ci-contre)."
        values={settings.subjects.map((s) => s.name)}
        usage={count(items, 'subject')}
        usageUnit="contentieux"
        recordsName="contentieux déjà saisis"
        busy={busy}
        onSave={async (s) => {
          // Un sujet renommé garde ses sous-sujets
          const subjects = s.values.map((name) => {
            const from = s.renames.find((r) => r.to === name)?.from ?? name;
            return { name, subs: settings.subjects.find((x) => x.name === from)?.subs || [] };
          });
          const ok = await save({ subjects }, 'subject', s);
          if (ok) {
            const renamed = s.renames.find((r) => r.from === subject);
            if (renamed) setSubject(renamed.to);
            else if (!s.values.includes(subject)) setSubject(s.values[0] || '');
          }
          return ok;
        }}
      />
      {current && (
        <div className="ct-subs">
          <label className="ct-subs-pick">
            Sous-sujets du sujet
            <select value={current.name} onChange={(e) => setSubject(e.target.value)}>
              {settings.subjects.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
          <ListEditor
            key={'subs-' + current.name + JSON.stringify(current.subs)}
            title={'Sous-sujets : ' + current.name}
            help="Proposés quand ce sujet est choisi."
            values={current.subs}
            usage={count(items, 'subSubject', (c) => c.subject === current.name)}
            usageUnit="contentieux"
            recordsName="contentieux déjà saisis"
            busy={busy}
            onSave={(s) =>
              save(
                {
                  subjects: settings.subjects.map((x) =>
                    x.name === current.name ? { ...x, subs: s.values } : x,
                  ),
                },
                'subSubject',
                s,
                { subject: current.name },
              )
            }
          />
        </div>
      )}
      <ListEditor
        key={'decisions-' + JSON.stringify(settings.decisions)}
        title="Décisions"
        help="Décision prise suite au contentieux (obligatoire pour le clore)."
        values={settings.decisions}
        usage={count(items, 'decision')}
        usageUnit="contentieux"
        recordsName="contentieux déjà saisis"
        busy={busy}
        onSave={(s) => save({ decisions: s.values }, 'decision', s)}
      />
    </div>
  );
}
