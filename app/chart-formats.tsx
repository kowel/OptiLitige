'use client';
import { createContext, useContext } from 'react';
import {
  CalendarDays,
  CalendarRange,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  Donut,
  Table,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Format des graphiques choisi par chaque compte (Analyses & rapports, tableaux de bord).
// Le choix est retenu pour le compte (enregistré côté serveur, action « prefs ») et vaut sur
// tous ses appareils.

export type ChartFormat =
  | 'bars'
  | 'columns'
  | 'donut'
  | 'pie'
  | 'table'
  | 'line'
  // Échelle du rythme des litiges : par jour ou par semaine
  | 'days'
  | 'weeks';

export const FORMAT_LABELS: Record<ChartFormat, string> = {
  bars: 'Barres horizontales',
  columns: 'Colonnes',
  donut: 'Anneau',
  pie: 'Camembert',
  table: 'Tableau',
  line: 'Courbes',
  days: 'Par jour (14 jours)',
  weeks: 'Par semaine (12 semaines)',
};
const FORMAT_ICONS: Record<ChartFormat, LucideIcon> = {
  bars: ChartBar,
  columns: ChartColumn,
  donut: Donut,
  pie: ChartPie,
  table: Table,
  line: ChartLine,
  days: CalendarDays,
  weeks: CalendarRange,
};
// Formats proposés pour une répartition (statuts, enseignes, transporteurs…)
export const SHARE_FORMATS: ChartFormat[] = ['bars', 'columns', 'donut', 'pie', 'table'];

interface ChartPrefs {
  formats: Record<string, string>;
  /** Ordre des graphiques par écran : { 'analyses:Admin': ['brands', 'activity', …] } */
  layouts: Record<string, string[]>;
  setFormat: (chart: string, format: ChartFormat) => void;
  setLayout: (screen: string, order: string[]) => void;
}
export const ChartPrefsContext = createContext<ChartPrefs>({
  formats: {},
  layouts: {},
  setFormat: () => {},
  setLayout: () => {},
});

// Format retenu pour un graphique (sinon celui par défaut) et fonction pour le changer
export function useChartFormat(chart: string, fallback: ChartFormat, allowed: ChartFormat[]) {
  const { formats, setFormat } = useContext(ChartPrefsContext);
  const saved = formats[chart] as ChartFormat | undefined;
  const format = saved && allowed.includes(saved) ? saved : fallback;
  return [format, (f: ChartFormat) => setFormat(chart, f)] as const;
}

// Petits boutons de choix du format, en haut à droite d'un graphique
export function FormatPicker({
  value,
  options,
  onChange,
  chartLabel,
}: {
  value: ChartFormat;
  options: ChartFormat[];
  onChange: (f: ChartFormat) => void;
  chartLabel: string;
}) {
  return (
    <div className="format-picker" role="group" aria-label={'Format du graphique ' + chartLabel}>
      {options.map((f) => {
        const Icon = FORMAT_ICONS[f];
        return (
          <button
            key={f}
            type="button"
            title={FORMAT_LABELS[f]}
            aria-label={FORMAT_LABELS[f]}
            aria-pressed={value === f}
            className={value === f ? 'active' : ''}
            onClick={() => onChange(f)}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
