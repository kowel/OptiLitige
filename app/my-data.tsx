'use client';
import { useState } from 'react';
import { CalendarRange, CheckCheck, Clock, FolderOpen, Hourglass, Store, Tags } from 'lucide-react';
import { ChartCard, StatChart } from './dashboard-visuals';
import PeriodPicker from './period-picker';
import { inPeriod } from './period.mjs';
import { myData } from './my-data.mjs';
import type { Dossier } from './types';

// « Ma data » (Relation client et SAV) : les chiffres des dossiers que l'agent a créés.
// Calculs : myData (app/my-data.mjs).

const number = (v: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);

export default function MyData({ records, email }: { records: Dossier[]; email: string }) {
  const [period, setPeriod] = useState('30');
  const mine = records.filter((r) => r.creator === email && inPeriod(r.created, period));
  const d = myData(mine);
  return (
    <div className="my-data">
      <div className="analytics-filter">
        <label>
          Période de création
          <PeriodPicker value={period} onChange={setPeriod} label="Période de création" />
        </label>
      </div>
      <div className="analytics-summary">
        <div>
          <span className="summary-icon violet">
            <FolderOpen size={19} />
          </span>
          <small>Dossiers créés</small>
          <strong>{d.total}</strong>
        </div>
        <div>
          <span className="summary-icon amber">
            <Hourglass size={19} />
          </span>
          <small>Encore ouverts · en attente RC</small>
          <strong>
            {d.open}
            <em> · {d.waitingRc}</em>
          </strong>
        </div>
        <div>
          <span className="summary-icon teal">
            <CheckCheck size={19} />
          </span>
          <small>Résolus</small>
          <strong>{d.resolved}</strong>
        </div>
        <div>
          <span className="summary-icon blue">
            <Clock size={19} />
          </span>
          <small>Délai moyen jusqu’à la solution client</small>
          <strong>
            {d.clientDays === null ? '—' : number(d.clientDays)}
            <em> jours</em>
          </strong>
        </div>
      </div>
      <div className="ct-dashboard-grid">
        <ChartCard
          title="Où en sont mes dossiers ?"
          subtitle="Répartition par statut"
          icon={FolderOpen}
        >
          <StatChart
            id="my-statuses"
            label="Mes dossiers par statut"
            rows={d.statuses}
            fallback="donut"
          />
        </ChartCard>
        <ChartCard
          title="Mes types de litiges"
          subtitle="Qualification saisie à l’ouverture"
          icon={Tags}
        >
          <StatChart id="my-types" label="Mes types de litiges" rows={d.types} />
        </ChartCard>
        <ChartCard title="Par enseigne" subtitle="Dossiers que j’ai créés" icon={Store}>
          <StatChart id="my-brands" label="Mes dossiers par enseigne" rows={d.brands} />
        </ChartCard>
        <ChartCard
          title="Mes créations par mois"
          subtitle="Sur la période choisie"
          icon={CalendarRange}
        >
          <StatChart
            id="my-months"
            label="Mes créations par mois"
            rows={d.months}
            fallback="columns"
          />
        </ChartCard>
      </div>
    </div>
  );
}
