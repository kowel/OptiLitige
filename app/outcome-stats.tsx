'use client';
import { ShieldAlert } from 'lucide-react';
import { outcomeStats } from './outcomes.mjs';
import { inPeriod, periodLabel } from './period.mjs';
import type { Dossier } from './types';

interface OutcomeStatsProps {
  records: Dossier[];
  period: string;
  slaNow: number;
}

const euros = (v: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v || 0);

// « Résultats des litiges » : ce que deviennent réellement les dossiers une fois requalifiés à la
// clôture (fraudes, requalifications), sur la période choisie (app/outcomes.mjs).
export default function OutcomeStats({ records, period, slaNow }: OutcomeStatsProps) {
  if (!slaNow) return null;
  const s = outcomeStats(records.filter((r) => inPeriod(r.created, period, slaNow)));
  const max = Math.max(1, ...s.byOutcome.map((o) => o.count));
  return (
    <section className="panel stats-panel outcome-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <ShieldAlert size={18} /> Résultats des litiges
          </h2>
          <span className="muted">
            Résultat final indiqué à la clôture · dossiers ouverts{' '}
            {periodLabel(period) ? '· ' + periodLabel(period) : 'sur la période choisie'}
          </span>
        </div>
      </div>
      {s.qualified ? (
        <>
          <div className="outcome-kpis">
            <div>
              <small>Dossiers qualifiés</small>
              <strong>{s.qualified}</strong>
              {s.toQualify > 0 && <em>{s.toQualify} clôturé(s) sans résultat</em>}
            </div>
            <div className="is-fraud">
              <small>Fraudes</small>
              <strong>
                {s.fraud} <span>· {s.fraudRate ?? 0} %</span>
              </strong>
              <em>{euros(s.fraudValue)} en jeu</em>
            </div>
            <div>
              <small>Requalifiés à la clôture</small>
              <strong>
                {s.requalified} <span>· {s.requalifiedRate ?? 0} %</span>
              </strong>
              <em>résultat différent du type déclaré</em>
            </div>
          </div>
          <div className="outcome-grid">
            <div>
              <h3>Répartition des résultats</h3>
              <ul className="outcome-bars">
                {s.byOutcome.map((o) => (
                  <li key={o.outcome} className={o.fraud ? 'is-fraud' : ''}>
                    <span className="outcome-name">{o.outcome}</span>
                    <span className="outcome-bar">
                      <i style={{ width: (o.count / max) * 100 + '%' }} />
                    </span>
                    <b>
                      {o.count} <small>({o.share} %)</small>
                    </b>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Requalifications les plus fréquentes</h3>
              {s.moves.length ? (
                <table className="stats-table outcome-moves">
                  <thead>
                    <tr>
                      <th>Déclaré à l’ouverture</th>
                      <th>Résultat final</th>
                      <th>Dossiers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.moves.map((m) => (
                      <tr key={m.from + '→' + m.to}>
                        <td>{m.from}</td>
                        <td>{m.to}</td>
                        <td>{m.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">Aucun dossier requalifié sur la période.</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="muted stats-empty">Aucun dossier qualifié sur cette période.</p>
      )}
    </section>
  );
}
