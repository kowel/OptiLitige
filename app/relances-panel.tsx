'use client';
import { ChevronDown, Download, MessageCircleQuestion } from 'lucide-react';
import { useEffect, useState } from 'react';
import { csvCell } from './csv.mjs';
import { inPeriod, periodLabel } from './period.mjs';
import { relanceStats } from './relances.mjs';
import { formatHours } from './sla.mjs';
import type { Dossier } from './types';

const DETAIL_KEY = 'optilitige-relances-detail';

type Row = {
  id: string;
  ref: string;
  commentId: string;
  date: string;
  author: string;
  service: string;
  target: string;
  kind: string;
  relance: boolean;
  client: boolean;
  source: string;
  replyHours: number | null;
  text: string;
};
type Group = {
  key: string;
  relances: number;
  dossiers: number;
  client: number;
  medianReplyHours: number | null;
};
type Stats = {
  tags: number;
  relances: number;
  share: number | null;
  dossiers: number;
  client: number;
  medianReplyHours: number | null;
  unanswered: number;
  byAgent: Group[];
  byService: Group[];
  byTarget: Group[];
  byMonth: Group[];
  topDossiers: { id: string; ref: string; relances: number; client: number; last: string }[];
};

const hours = (h: number | null) => (h === null ? '—' : formatHours(h));
const roleName = (r: string) => (r === 'RC' ? 'Relation client' : r);
const monthName = (k: string) => {
  const [y, m] = k.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
};
const day = (d: string) => String(d).slice(0, 10).split('-').reverse().join('/');

function GroupTable({ title, first, rows }: { title: string; first: string; rows: Group[] }) {
  if (!rows.length) return null;
  const top = Math.max(...rows.map((r) => r.relances), 1);
  return (
    <div className="relances-block">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th>{first}</th>
              <th>Relances</th>
              <th>Dossiers relancés</th>
              <th>Client qui s’impatiente</th>
              <th>Réponse du Service Litige (médiane)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key}>
                <td>{g.key}</td>
                <td>
                  <span className="carrier-cost-bar relances-bar">
                    <i style={{ width: Math.round((g.relances / top) * 100) + '%' }} />
                    {g.relances}
                  </span>
                </td>
                <td>{g.dossiers}</td>
                <td>{g.client}</td>
                <td>{hours(g.medianReplyHours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Analyses litiges (admins seulement) : relances du Service Litige par la RC, le SAV… Les chiffres
// viennent de /api/data?part=relances, qui refuse les autres rôles.
export default function RelancesPanel({
  records,
  period,
  slaNow,
  onOpen,
}: {
  records: Dossier[];
  period: string;
  slaNow: number;
  onOpen: (record: Dossier) => void;
}) {
  const [all, setAll] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [showList, setShowList] = useState(false);
  // Détail (tableaux, dossiers les plus relancés, liste) replié par défaut : seuls le titre et
  // les 4 chiffres restent. Choix retenu sur ce poste (simple confort, sans conséquence s'il
  // est perdu). Lu au premier affichage : le bouton n'apparaît qu'une fois les relances
  // chargées dans le navigateur, donc pas d'écart avec le rendu serveur.
  const [detail, setDetail] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(DETAIL_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleDetail = () => {
    const next = !detail;
    setDetail(next);
    try {
      localStorage.setItem(DETAIL_KEY, next ? '1' : '0');
    } catch {}
  };
  useEffect(() => {
    let live = true;
    fetch('/api/data?part=relances', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d.error) setError(d.error);
        else setAll(d.rows || []);
      })
      .catch(() => live && setError('Chargement impossible'));
    return () => {
      live = false;
    };
  }, []);
  if (!slaNow) return null;
  const rows = (all || []).filter((r) => inPeriod(r.date, period, slaNow));
  const s = relanceStats(rows) as Stats;
  const relances = rows
    .filter((r) => r.relance)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const byService = s.byService.map((g) => ({ ...g, key: roleName(g.key) }));
  const byMonth = s.byMonth.map((g) => ({ ...g, key: monthName(g.key) }));
  const record = (id: string) => records.find((r) => r.id === id);

  function exportCsv() {
    const lines = [
      [
        'Date',
        'Dossier',
        'Auteur',
        'Service',
        'Personne relancée',
        'Relance',
        'Client qui s’impatiente',
        'Réponse (heures)',
        'Message',
      ],
      ...rows.map((r) => [
        day(r.date),
        r.ref,
        r.author,
        roleName(r.service),
        r.target,
        r.relance ? 'Oui' : 'Non',
        r.client ? 'Oui' : 'Non',
        r.replyHours === null ? '' : String(r.replyHours).replace('.', ','),
        r.text.replace(/\s+/g, ' '),
      ]),
    ];
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'optilitige-relances-service-litige.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="panel stats-panel relances-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <MessageCircleQuestion size={18} /> Relances au Service Litige
          </h2>
          <span className="muted">
            Fois où un agent RC ou SAV relance le Service Litige (où en est le dossier, a-t-on une
            réponse ?) · visible par les admins seulement
            {periodLabel(period) ? ' · ' + periodLabel(period) : ''}
          </span>
        </div>
        <button type="button" className="secondary" onClick={exportCsv} disabled={!rows.length}>
          <Download size={15} /> Exporter
        </button>
      </div>
      {error ? (
        <p className="muted stats-empty">{error}</p>
      ) : !all ? (
        <p className="muted stats-empty">Analyse des échanges…</p>
      ) : !rows.length ? (
        <p className="muted stats-empty">Aucun message au Service Litige sur cette période.</p>
      ) : (
        <>
          <div className="carrier-cost-kpis">
            <div className="loss">
              <span>Relances</span>
              <b>{s.relances}</b>
              <small>
                sur {s.tags} message(s) au Service Litige
                {s.share !== null ? ' (' + s.share + ' %)' : ''}
              </small>
            </div>
            <div>
              <span>Dossiers relancés</span>
              <b>{s.dossiers}</b>
              <small>
                {s.dossiers ? (s.relances / s.dossiers).toFixed(1).replace('.', ',') : '0'}{' '}
                relance(s) par dossier en moyenne
              </small>
            </div>
            <div>
              <span>Client qui s’impatiente</span>
              <b>{s.client}</b>
              <small>relances où le client relance, appelle ou menace</small>
            </div>
            <div>
              <span>Réponse après une relance</span>
              <b>{hours(s.medianReplyHours)}</b>
              <small>médiane · {s.unanswered} relance(s) restée(s) sans réponse écrite</small>
            </div>
          </div>
          <button
            type="button"
            className={'relances-toggle' + (detail ? ' open' : '')}
            aria-expanded={detail}
            onClick={toggleDetail}
          >
            <ChevronDown size={16} />
            {detail ? 'Masquer le détail' : 'Voir le détail'}
            <span className="muted">
              par service, agent, personne relancée et mois · dossiers les plus relancés
            </span>
          </button>
          {detail && (
            <>
              <GroupTable title="Par service" first="Service" rows={byService} />
              <GroupTable title="Par agent" first="Agent" rows={s.byAgent} />
              <GroupTable title="Par personne relancée" first="Service Litige" rows={s.byTarget} />
              <GroupTable title="Par mois" first="Mois" rows={byMonth} />
              {s.topDossiers.length > 0 && (
                <div className="relances-block">
                  <h3>Dossiers les plus relancés</h3>
                  <div className="table-scroll">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Dossier</th>
                          <th>Relances</th>
                          <th>Client qui s’impatiente</th>
                          <th>Dernière relance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.topDossiers.map((d) => {
                          const r = record(d.id);
                          return (
                            <tr key={d.id}>
                              <td>
                                {r ? (
                                  <button
                                    type="button"
                                    className="text-btn"
                                    onClick={() => onOpen(r)}
                                  >
                                    {d.ref}
                                  </button>
                                ) : (
                                  d.ref
                                )}{' '}
                                {r && <span className="muted">{r.title}</span>}
                              </td>
                              <td>{d.relances}</td>
                              <td>{d.client}</td>
                              <td>{day(d.last)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="relances-block">
                <button type="button" className="text-btn" onClick={() => setShowList(!showList)}>
                  {showList ? 'Masquer' : 'Voir'} les {relances.length} relance(s) de la période
                </button>
                {showList && (
                  <ul className="relances-list">
                    {relances.slice(0, 300).map((r) => {
                      const rec = record(r.id);
                      return (
                        <li key={r.commentId}>
                          <span className="muted">
                            {day(r.date)} ·{' '}
                            {rec ? (
                              <button
                                type="button"
                                className="text-btn"
                                onClick={() => onOpen(rec)}
                              >
                                {r.ref}
                              </button>
                            ) : (
                              r.ref
                            )}{' '}
                            · {r.author} ({roleName(r.service)}) → {r.target}
                            {r.client ? ' · client qui s’impatiente' : ''}
                          </span>
                          <q>{r.text}</q>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <p className="muted relances-note">
                Les messages repris de SharePoint ont été classés un par un d’après leur sens ; les
                nouveaux messages sont reconnus automatiquement par leurs tournures (« des nouvelles
                ? », « un retour ? », « toujours rien », « je me permets de relancer »…). Les
                relances faites hors de l’outil (Teams, mail, téléphone) ne sont pas comptées.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
