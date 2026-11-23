'use client';
import { ArrowUpRight, FileBarChart, Filter, FolderOpen, RotateCcw } from 'lucide-react';
import PeriodPicker from './period-picker';
import { ANALYTICS_LABELS, EMPTY_ANALYTICS, countAnalytics } from './analytics-filters.mjs';
import { SOURCE_LABELS } from './advanced-filters.mjs';

export type AnalyticsFilters = typeof EMPTY_ANALYTICS;
export interface AnalyticsOptions {
  brands: string[];
  stores: string[];
  carriers: string[];
  types: string[];
  products: string[];
  members: { email: string; name: string }[];
}

// Grande barre de filtres en haut d'« Analyses & rapports » : période + critères.
// Tout l'écran en dessous (indicateurs, graphiques, issues, tableau) suit ces choix.
export default function AnalyticsFilterBar({
  filters,
  onChange,
  options,
  period,
  onPeriod,
  shown,
  total,
  onExport,
  onReport,
  onOpenList,
}: {
  filters: AnalyticsFilters;
  onChange: (f: AnalyticsFilters) => void;
  options: AnalyticsOptions;
  period: string;
  onPeriod: (p: string) => void;
  shown: number;
  total: number;
  onExport: () => void;
  onReport?: () => void;
  onOpenList?: () => void;
}) {
  const active = countAnalytics(filters);
  const set = (key: keyof AnalyticsFilters, value: string) => {
    const next = { ...filters, [key]: value };
    // Le magasin n'a de sens qu'avec l'enseigne « MAGASIN » (ou sans enseigne choisie)
    if (key === 'brand' && value && value !== 'MAGASIN') next.store = '';
    onChange(next);
  };
  const select = (key: keyof AnalyticsFilters, all: string, items: [string, string][]) => (
    <label className={filters[key] ? 'on' : ''}>
      <span>{ANALYTICS_LABELS[key]}</span>
      <select
        aria-label={ANALYTICS_LABELS[key]}
        value={filters[key]}
        onChange={(e) => set(key, e.target.value)}
      >
        <option value="">{all}</option>
        {items.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  const plain = (list: string[]) => list.map((v) => [v, v] as [string, string]);
  const showStore = !filters.brand || filters.brand === 'MAGASIN';

  return (
    <section className="analytics-filter-bar" aria-label="Filtres des analyses">
      <div className="afb-head">
        <h2>
          <Filter size={17} /> Filtres des analyses
        </h2>
        <span className="afb-count">
          <b>{shown}</b> dossier(s) sur {total} de la période
          {active > 0 && <em> · {active} filtre(s) actif(s)</em>}
        </span>
        <div className="afb-actions">
          {active > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => onChange({ ...EMPTY_ANALYTICS })}
            >
              <RotateCcw size={15} /> Réinitialiser
            </button>
          )}
          {onReport && (
            <button type="button" className="secondary" onClick={onReport}>
              <FileBarChart size={15} /> Rapport (PDF)
            </button>
          )}
          {onOpenList && (
            <button
              type="button"
              className="primary"
              onClick={onOpenList}
              disabled={shown === 0}
              title="Ouvrir la liste des dossiers avec la période et les filtres ci-dessous"
            >
              <FolderOpen size={15} /> Voir les dossiers concernés ({shown})
            </button>
          )}
          <button type="button" className="secondary" onClick={onExport}>
            <ArrowUpRight size={15} /> Exporter les dossiers filtrés
          </button>
        </div>
      </div>
      <div className="afb-grid">
        <label className="afb-period">
          <span>Période d’ouverture</span>
          <PeriodPicker value={period} onChange={onPeriod} label="Période d’ouverture" />
        </label>
        {select('brand', 'Toutes les enseignes', plain(options.brands))}
        {showStore && select('store', 'Tous les magasins', plain(options.stores))}
        {select('carrier', 'Tous les transporteurs', plain(options.carriers))}
        {select('type', 'Tous les types', plain(options.types))}
        {select('productType', 'Tous les produits', plain(options.products))}
        {select('origin', 'Toutes les origines', plain(['Transport', 'Interne']))}
        {select('source', 'Tous les services', Object.entries(SOURCE_LABELS) as [string, string][])}
        {select('assignee', 'Tous les agents', [
          ['none', 'Non attribués'],
          ...options.members.map((m) => [m.email, m.name || m.email] as [string, string]),
        ])}
        {select('priority', 'Toutes', [
          ['urgent', 'Urgents seulement'],
          ['normal', 'Hors urgents'],
        ])}
        {select('credit', 'Avec ou sans', [
          ['with', 'Avec avoir'],
          ['without', 'Sans avoir'],
        ])}
        {select('imputation', 'Toutes', [
          ['Interne', 'Interne'],
          ['Transporteur', 'Transporteur'],
          ['Autre', 'Autre'],
          ['none', 'Non précisée'],
        ])}
      </div>
    </section>
  );
}
