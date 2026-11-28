'use client';
import { useContext, useId, useState } from 'react';
import { ChartPrefsContext, FormatPicker, SHARE_FORMATS, useChartFormat } from './chart-formats';
import type { ChartFormat } from './chart-formats';
import PeriodPicker from './period-picker';
import { inPeriod } from './period.mjs';
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  Clock,
  Truck,
  Users,
  Wallet,
  Tags,
  Building2,
  CheckCheck,
  FolderOpen,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Lock,
  LockOpen,
} from 'lucide-react';
import { buildDashboardData, dashboardColors } from './dashboard-data.mjs';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Dossier, Member } from './types';

// Ligne d'un graphique (barres ou anneau)
interface ChartRow {
  label: string;
  value: number;
  color?: string;
}
// Point du graphique d'activité : un jour
interface ActivityPoint {
  key: string;
  label: string;
  /** Libellé complet de l'infobulle (ex. « Semaine du 03/11 au 09/11 ») */
  title?: string;
  opened: number;
  closed: number;
}
interface ChartCardProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  tone?: string;
  aside?: ReactNode;
}
interface DashboardVisualsProps {
  records: Dossier[];
  members: Member[];
  view: string;
  onStatus?: (status: string) => void;
  expanded?: boolean;
  /** Dossiers du « rythme des litiges » quand ils diffèrent de `records` (analyses : toutes les
   * dates d'ouverture, la courbe montrant ses propres 14 jours ou 12 semaines) */
  activityRecords?: Dossier[];
}
interface AnalyticsDashboardProps {
  records: Dossier[];
  members: Member[];
  period: string;
  onPeriod: (period: string) => void;
  onExport: (rows: Dossier[]) => void;
  onStatus?: (status: string) => void;
  /** Barre de filtres affichée à la place du simple choix de période */
  toolbar?: ReactNode;
}
const formatMoney = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n || 0);
const number = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n || 0);
function EmptyChart() {
  return (
    <div className="chart-empty">
      <ChartNoAxesCombined size={27} />
      <p>Les graphiques se rempliront avec vos dossiers.</p>
    </div>
  );
}
export function ChartCard({
  title,
  subtitle,
  icon: Icon = ChartNoAxesCombined,
  children,
  className = '',
  tone = 'violet',
  aside,
}: ChartCardProps) {
  return (
    <section className={'visual-card ' + className}>
      <div className="visual-heading">
        <div className={'visual-icon ' + tone}>
          <Icon size={18} />
        </div>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {aside && <span className="visual-aside">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
// Part en pourcentage ; « < 1 % » pour une très petite part non nulle
const percent = (v: number, total: number) => {
  const p = (v / (total || 1)) * 100;
  return v > 0 && p < 1 ? '< 1 %' : Math.round(p) + ' %';
};
function Ring({
  rows,
  total,
  onStatus,
  pie = false,
  currency = false,
}: {
  rows: ChartRow[];
  total: number;
  onStatus?: (status: string) => void;
  /** Camembert plein plutôt qu'anneau */
  pie?: boolean;
  currency?: boolean;
}) {
  // Anneau : rayon 63, épaisseur 17 ; camembert : rayon 37, épaisseur 74 (disque plein)
  const radius = pie ? 37 : 63,
    width = pie ? 74 : 17,
    gap = pie ? 1 : 4;
  const circumference = 2 * Math.PI * radius;
  const shown = (v: number) => (currency ? formatMoney(v) : v);
  // Part survolée : son nom, sa valeur et son pourcentage au centre / dans une infobulle
  const [hover, setHover] = useState<string | null>(null);
  const hovered = rows.find((r) => r.label === hover);
  // Début de chaque arc : somme des parts qui le précèdent
  const starts: Record<string, number> = {};
  rows
    .filter((r) => r.value)
    .reduce((acc: number, r) => {
      starts[r.label] = acc;
      return acc + (r.value / (total || 1)) * circumference;
    }, 0);
  return (
    <div className="ring-layout">
      <div className="ring-figure">
        <svg
          viewBox="0 0 170 170"
          role="img"
          aria-label={'Répartition : ' + rows.map((r) => r.label + ' ' + shown(r.value)).join(', ')}
        >
          <circle cx="85" cy="85" r={radius} fill="none" stroke="#edf0f7" strokeWidth={width} />
          {rows
            .filter((r) => r.value)
            .map((r) => {
              const share = r.value / (total || 1);
              const length = share * circumference;
              const start = starts[r.label];
              return (
                <circle
                  key={r.label}
                  cx="85"
                  cy="85"
                  r={radius}
                  fill="none"
                  stroke={r.color}
                  strokeWidth={width}
                  strokeDasharray={
                    Math.max(0, length - gap) + ' ' + (circumference - Math.max(0, length - gap))
                  }
                  strokeDashoffset={-start}
                  transform="rotate(-90 85 85)"
                  className={'ring-part' + (hover && hover !== r.label ? ' dimmed' : '')}
                  onPointerEnter={() => setHover(r.label)}
                  onPointerDown={() => setHover(r.label)}
                  onPointerLeave={() => setHover(null)}
                >
                  <title>{r.label + ' : ' + shown(r.value)}</title>
                </circle>
              );
            })}
        </svg>
        {!pie && (
          <div>
            <strong>
              {hovered ? shown(hovered.value) : currency ? formatMoney(total) : total}
            </strong>
            <span>
              {hovered
                ? hovered.label + ' · ' + percent(hovered.value, total)
                : currency
                  ? 'au total'
                  : 'dossiers'}
            </span>
          </div>
        )}
        {pie && hovered && (
          <div className="chart-tooltip ring-tooltip" role="status">
            <b>{hovered.label}</b>
            <span>
              <strong>{shown(hovered.value)}</strong> · {percent(hovered.value, total)}
            </span>
          </div>
        )}
      </div>
      <div className="ring-legend">
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            disabled={!onStatus}
            onClick={() => onStatus?.(r.label)}
            onPointerEnter={() => setHover(r.label)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="legend-label">
              <i style={{ background: r.color }} />
              {r.label}
            </span>
            <b>
              {shown(r.value)}
              {!currency && ' · ' + percent(r.value, total)}
            </b>
            {onStatus && <ArrowUpRight size={12} />}
          </button>
        ))}
      </div>
    </div>
  );
}
// Volume : le nombre et sa part du total (« 12 · 35 % ») ; valeur : le montant
const share = (v: number, total: number) =>
  total ? ' · ' + Math.round((v / total) * 100) + ' %' : '';
function Bars({ rows, currency = false }: { rows: ChartRow[]; currency?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((n, r) => n + r.value, 0);
  if (!rows.some((r) => r.value)) return <EmptyChart />;
  return (
    <div className="visual-bars">
      {rows.map((r, i: number) => (
        <div className="visual-bar-row" key={r.label}>
          <div>
            <span title={r.label}>{r.label}</span>
            <b>{currency ? formatMoney(r.value) : r.value + share(r.value, total)}</b>
          </div>
          <div className="visual-track">
            <div
              style={{
                width: (r.value / max) * 100 + '%',
                background: r.color || dashboardColors[i % dashboardColors.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
function ActivityGraph({
  data,
  format = 'line',
  span = '14 jours',
}: {
  data: ActivityPoint[];
  format?: string;
  span?: string;
}) {
  const id = useId().replaceAll(':', ''),
    // Maximum arrondi au multiple de 3 : graduations en nombres entiers (0, 2, 4, 6…)
    max = Math.ceil(Math.max(3, ...data.flatMap((r) => [r.opened, r.closed])) / 3) * 3,
    left = 31,
    right = 590,
    top = 18,
    bottom = 160;
  // Courbe : un point par jour, du bord gauche au bord droit. Colonnes : chaque jour occupe une
  // case de même largeur et ses barres sont centrées dedans (elles ne débordent plus sur l'axe
  // à gauche ni hors du cadre à droite).
  const columns = format === 'columns',
    step = columns ? (right - left) / (data.length || 1) : (right - left) / (data.length - 1 || 1);
  const x = (i: number) => left + (columns ? (i + 0.5) * step : i * step),
    y = (v: number) => bottom - (v / max) * (bottom - top);
  const line = (key: 'opened' | 'closed') =>
    data.map((r, i: number) => (i ? 'L' : 'M') + x(i) + ',' + y(r[key])).join(' ');
  const totalOpened = data.reduce((n: number, r) => n + r.opened, 0),
    totalClosed = data.reduce((n: number, r) => n + r.closed, 0);
  // Jour survolé (souris) ou touché (téléphone) : repère vertical et infobulle avec les chiffres
  const [hover, setHover] = useState<number | null>(null);
  const hovered = hover === null ? null : data[hover];
  return (
    <>
      <div className="activity-stats">
        <div>
          <i className="dot-opened" />
          <span>Ouvertures</span>
          <strong>{totalOpened}</strong>
        </div>
        <div>
          <i className="dot-closed" />
          <span>Clôtures datées</span>
          <strong>{totalClosed}</strong>
        </div>
      </div>
      <div className="visual-line-chart" onPointerLeave={() => setHover(null)}>
        <svg
          viewBox="0 0 610 198"
          role="img"
          aria-label={
            totalOpened + ' ouvertures et ' + totalClosed + ' clôtures datées sur ' + span
          }
        >
          <defs>
            <linearGradient id={'activity-' + id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7857e8" stopOpacity=".23" />
              <stop offset="100%" stopColor="#7857e8" stopOpacity=".015" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((i) => {
            const v = (max * i) / 3;
            return (
              <g key={i}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="#e9edf5"
                  strokeDasharray="3 5"
                />
                <text x="20" y={y(v) + 3} textAnchor="end" fill="#94a0b5" fontSize="9">
                  {Number.isInteger(v) ? v : number(v)}
                </text>
              </g>
            );
          })}
          {format === 'columns' &&
            data.map((r, i: number) => {
              // Colonnes : ouvertures (violet) et clôtures (vert) côte à côte pour chaque jour
              const w = Math.max(3, Math.min(26, step / 2 - 4));
              return (
                <g key={'c' + r.key}>
                  <rect
                    x={x(i) - w - 1}
                    y={y(r.opened)}
                    width={w}
                    height={bottom - y(r.opened)}
                    rx="2"
                    fill="#7857e8"
                  ></rect>
                  <rect
                    x={x(i) + 1}
                    y={y(r.closed)}
                    width={w}
                    height={bottom - y(r.closed)}
                    rx="2"
                    fill="#17b399"
                  ></rect>
                </g>
              );
            })}
          {format !== 'columns' && (
            <path
              d={line('opened') + ' L ' + right + ',' + bottom + ' L ' + left + ',' + bottom + ' Z'}
              fill={'url(#activity-' + id + ')'}
            />
          )}
          {format !== 'columns' && (
            <>
              <path
                d={line('closed')}
                fill="none"
                stroke="#17b399"
                strokeWidth="2.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={line('opened')}
                fill="none"
                stroke="#7857e8"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}
          {data.map((r, i: number) => (
            <g key={r.key}>
              {format !== 'columns' && (
                <>
                  <circle
                    cx={x(i)}
                    cy={y(r.opened)}
                    r={hover === i ? 5.5 : 3.5}
                    fill="#7857e8"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={x(i)}
                    cy={y(r.closed)}
                    r={hover === i ? 5 : 3}
                    fill="#17b399"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                </>
              )}
              {(i % 3 === 0 || i === data.length - 1) && (
                <text x={x(i)} y="185" textAnchor="middle" fill="#8b97ad" fontSize="9">
                  {r.label}
                </text>
              )}
            </g>
          ))}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={top - 6}
              y2={bottom}
              stroke="#b9acf2"
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}
          {/* Zones de survol : une bande verticale par jour, plus facile à viser qu'un point */}
          {data.map((r, i: number) => (
            <rect
              key={'h' + r.key}
              className="chart-hit"
              x={x(i) - step / 2}
              y={top - 10}
              width={step}
              height={bottom - top + 14}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
              tabIndex={0}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={r.label + ' : ' + r.opened + ' ouverture(s), ' + r.closed + ' clôture(s)'}
            />
          ))}
        </svg>
        {hovered && (
          <div
            // Près des bords, l'infobulle s'aligne vers l'intérieur pour rester visible
            className={
              'chart-tooltip' +
              (x(hover!) / 610 > 0.78 ? ' edge-right' : x(hover!) / 610 < 0.22 ? ' edge-left' : '')
            }
            role="status"
            style={{
              left: (x(hover!) / 610) * 100 + '%',
              top: (y(Math.max(hovered.opened, hovered.closed)) / 198) * 100 + '%',
            }}
          >
            <b>{hovered.title || hovered.label}</b>
            <span>
              <i className="dot-opened" /> Ouvertures <strong>{hovered.opened}</strong>
            </span>
            <span>
              <i className="dot-closed" /> Clôtures <strong>{hovered.closed}</strong>
            </span>
          </div>
        )}
      </div>
    </>
  );
}
// Carte de répartition dont le format est choisi par le compte (barres, colonnes, anneau…)
export function StatChart({
  id,
  label,
  rows,
  currency = false,
  fallback = 'bars',
  onSelect,
}: {
  id: string;
  label: string;
  rows: ChartRow[];
  currency?: boolean;
  fallback?: ChartFormat;
  onSelect?: (label: string) => void;
}) {
  const [format, setFormat] = useChartFormat(id, fallback, SHARE_FORMATS);
  const colored = rows.map((r, i) => ({
    ...r,
    color: r.color || dashboardColors[i % dashboardColors.length],
  }));
  const total = colored.reduce((n, r) => n + r.value, 0);
  return (
    <>
      <FormatPicker
        value={format}
        options={SHARE_FORMATS}
        onChange={setFormat}
        chartLabel={label}
      />
      {!rows.some((r) => r.value) ? (
        <EmptyChart />
      ) : format === 'columns' ? (
        <Columns rows={colored} currency={currency} />
      ) : format === 'donut' || format === 'pie' ? (
        <Ring
          rows={colored}
          total={total}
          onStatus={onSelect}
          pie={format === 'pie'}
          currency={currency}
        />
      ) : format === 'table' ? (
        <ShareTable rows={colored} total={total} currency={currency} />
      ) : (
        <Bars rows={colored} currency={currency} />
      )}
    </>
  );
}

// Colonnes verticales
function Columns({ rows, currency }: { rows: ChartRow[]; currency: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <div className="visual-columns">
      {rows.map((r) => (
        <div key={r.label} className="visual-column" title={r.label}>
          <b>
            {currency ? formatMoney(r.value) : r.value}
            {!currency && total > 0 && <small>{Math.round((r.value / total) * 100)} %</small>}
          </b>
          <div className="visual-column-track">
            <div style={{ height: (r.value / max) * 100 + '%', background: r.color }} />
          </div>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

// Tableau : valeur et part de chaque ligne
function ShareTable({
  rows,
  total,
  currency,
}: {
  rows: ChartRow[];
  total: number;
  currency: boolean;
}) {
  return (
    <table className="visual-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>
              <i style={{ background: r.color }} />
              {r.label}
            </td>
            <td>{currency ? formatMoney(r.value) : r.value}</td>
            <td>{total ? Math.round((r.value / total) * 100) : 0} %</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Carte du tableau de bord : identifiant (ordre et format), largeur, contenu
interface CardDef {
  id: string;
  wide?: boolean;
  node: ReactNode;
}

// Même répartition en volume (nombre de dossiers) ou en valeur (montant en jeu, en euros)
function VolumeValue({
  id,
  label,
  volume,
  value,
}: {
  id: string;
  label: string;
  volume: ChartRow[];
  value: ChartRow[];
}) {
  const [mode, setMode] = useState<'volume' | 'value'>('volume');
  return (
    <>
      <div className="volume-value">
        <div className="scale-toggle" role="group" aria-label={label + ' : volume ou valeur'}>
          <button
            type="button"
            aria-pressed={mode === 'volume'}
            className={mode === 'volume' ? 'active' : ''}
            onClick={() => setMode('volume')}
          >
            Volume
          </button>
          <button
            type="button"
            aria-pressed={mode === 'value'}
            className={mode === 'value' ? 'active' : ''}
            onClick={() => setMode('value')}
          >
            Valeur
          </button>
        </div>
      </div>
      {mode === 'volume' ? (
        <StatChart id={id} label={label} rows={volume} />
      ) : (
        <StatChart id={id + '-value'} label={label + ' (valeur)'} rows={value} currency />
      )}
    </>
  );
}

const days = (v: number | null) => (v === null ? '—' : number(v) + ' j');

export default function DashboardVisuals({
  records,
  members,
  view,
  onStatus,
  expanded = false,
  activityRecords,
}: DashboardVisualsProps) {
  const d = buildDashboardData(records, members);
  // Rythme : ouvertures et clôtures des 14 derniers jours ou 12 dernières semaines, quelle que
  // soit la période choisie (sinon tout ce qui précède la période apparaîtrait à zéro)
  const pace = activityRecords ? buildDashboardData(activityRecords, members) : d;
  const isRC = view === 'RC' || view === 'SAV',
    isLitige = view === 'Service Litige';
  const { layouts, setLayout } = useContext(ChartPrefsContext);
  const [unlocked, setUnlocked] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [activityFormat, setActivityFormat] = useChartFormat('activity', 'line', [
    'line',
    'columns',
  ]);
  // Rythme par jour (14 jours) ou par semaine (12 semaines), choisi par le compte
  const [activityScale, setActivityScale] = useChartFormat('activity-scale', 'days', [
    'days',
    'weeks',
  ]);
  const weekly = activityScale === 'weeks';
  const card = (
    id: string,
    title: string,
    subtitle: string,
    icon: LucideIcon,
    tone: string,
    body: ReactNode,
    note?: ReactNode,
  ): CardDef => ({
    id,
    node: (
      <ChartCard title={title} subtitle={subtitle} icon={icon} tone={tone}>
        {body}
        {note}
      </ChartCard>
    ),
  });
  const stat = (id: string, label: string, rows: ChartRow[], currency = false) => (
    <StatChart id={id} label={label} rows={rows} currency={currency} />
  );
  const cards: CardDef[] = [
    {
      id: 'activity',
      wide: true,
      node: (
        <ChartCard
          title="Le rythme des litiges"
          subtitle={
            'Ouvertures et clôtures datées · ' +
            (weekly ? '12 dernières semaines' : '14 derniers jours')
          }
          icon={Activity}
          aside={weekly ? '12 semaines' : '14 jours'}
        >
          <div className="activity-controls">
            <div className="scale-toggle" role="group" aria-label="Échelle du rythme des litiges">
              <button
                type="button"
                aria-pressed={!weekly}
                className={!weekly ? 'active' : ''}
                onClick={() => setActivityScale('days')}
              >
                Par jour
              </button>
              <button
                type="button"
                aria-pressed={weekly}
                className={weekly ? 'active' : ''}
                onClick={() => setActivityScale('weeks')}
              >
                Par semaine
              </button>
            </div>
            <FormatPicker
              value={activityFormat}
              options={['line', 'columns']}
              onChange={setActivityFormat}
              chartLabel="Le rythme des litiges"
            />
          </div>
          <ActivityGraph
            key={activityScale}
            data={weekly ? pace.activityWeeks : pace.activity}
            format={activityFormat}
            span={weekly ? '12 semaines' : '14 jours'}
          />
        </ChartCard>
      ),
    },
    card(
      'statuses',
      'Où en sont les dossiers ?',
      'Répartition par statut · cliquez pour explorer',
      FolderOpen,
      'blue',
      <StatChart
        id="statuses"
        label="Où en sont les dossiers ?"
        rows={d.statuses}
        fallback="donut"
        onSelect={onStatus}
      />,
    ),
    ...(isRC
      ? [
          card(
            'origins',
            'D’où viennent les litiges ?',
            'Transport ou traitement interne',
            Truck,
            'blue',
            stat('origins', 'D’où viennent les litiges ?', d.origins),
            <div className="visual-card-note">{d.total} dossier(s) au total</div>,
          ),
          card(
            'activeTypes',
            'Les motifs à suivre',
            'Types à l’ouverture · dossiers en cours',
            Tags,
            'violet',
            stat('activeTypes', 'Les motifs à suivre', d.activeTypes),
          ),
        ]
      : isLitige
        ? [
            card(
              'sources',
              'D’où viennent les dossiers',
              'Dossiers ouverts selon le service qui les a créés',
              Users,
              'blue',
              stat('sources', 'D’où viennent les dossiers', d.sources),
            ),
            card(
              'transportStages',
              'L’attente transporteur',
              'Étapes des dossiers transport ouverts',
              Truck,
              'teal',
              stat('transportStages', 'L’attente transporteur', d.transportStages),
              <div className={'visual-card-note ' + (d.relances ? 'needs-attention' : '')}>
                <span className="note-dot amber" />
                {d.relances} relance(s) transporteur arrivée(s) à échéance
              </div>,
            ),
            card(
              'ages',
              'Les dossiers qui prennent de l’âge',
              'Ancienneté des dossiers encore ouverts',
              Clock,
              'amber',
              stat('ages', 'Les dossiers qui prennent de l’âge', d.ages),
            ),
            card(
              'brandsTop3',
              'Répartition par enseigne',
              'Les 3 enseignes qui ont le plus de dossiers',
              Building2,
              'blue',
              stat('brandsTop3', 'Répartition par enseigne', d.brandsTop3),
            ),
            card(
              'carriersTop3',
              'Répartition par transporteur',
              'Les 3 transporteurs qui ont le plus de dossiers transport',
              Truck,
              'teal',
              stat('carriersTop3', 'Répartition par transporteur', d.carriersTop3),
            ),
          ]
        : [
            card(
              'finance',
              'L’impact financier',
              'Montants renseignés dans les dossiers',
              Wallet,
              'teal',
              stat('finance', 'L’impact financier', d.finance, true),
              <div className="visual-card-note">
                Montant des avoirs : <b>{formatMoney(d.creditTotal)}</b>
              </div>,
            ),
            card(
              'brands',
              'L’activité par enseigne',
              'En volume (nombre de dossiers) ou en valeur (montant en jeu)',
              Building2,
              'blue',
              <VolumeValue
                id="brands"
                label="L’activité par enseigne"
                volume={d.brands}
                value={d.brandsValue}
              />,
            ),
            card(
              'ages',
              'L’âge des dossiers en cours',
              'Depuis combien de jours les dossiers ouverts attendent leur solution',
              Clock,
              'amber',
              stat('ages', 'L’âge des dossiers en cours', d.ages),
              <div className="visual-card-note">
                Délais moyens · client : <b>{days(d.delays.client.days)}</b> · transporteur :{' '}
                <b>{days(d.delays.carrier.days)}</b> · dossier : <b>{days(d.delays.common.days)}</b>
              </div>,
            ),
          ]),
    ...(expanded
      ? [
          card(
            'types',
            'Les principaux types de litiges',
            'Qualification à l’ouverture · en volume ou en valeur',
            Tags,
            'violet',
            <VolumeValue
              id="types"
              label="Les principaux types de litiges"
              volume={d.types}
              value={d.typesValue}
            />,
          ),
          card(
            'carriers',
            'Les transporteurs concernés',
            'Dossiers d’origine transport · en volume ou en valeur',
            Truck,
            'blue',
            <VolumeValue
              id="carriers"
              label="Les transporteurs concernés"
              volume={d.carriers}
              value={d.carriersValue}
            />,
          ),
          card(
            'workload',
            'Répartition des dossiers ouverts par agent',
            'Dossiers encore ouverts, selon l’agent qui les a créés',
            Users,
            'teal',
            stat('workload', 'Répartition des dossiers ouverts par agent', d.workload),
          ),
        ]
      : []),
  ];
  // Disposition propre au compte et à l'écran (vue d'ensemble de chaque service, analyses)
  const layoutKey = (expanded ? 'analyses' : 'dashboard') + ':' + (isRC ? 'RC' : view);
  const saved = layouts[layoutKey] || [];
  const ordered = [...cards].sort((a, b) => {
    const ia = saved.indexOf(a.id),
      ib = saved.indexOf(b.id);
    return (ia < 0 ? 99 + cards.indexOf(a) : ia) - (ib < 0 ? 99 + cards.indexOf(b) : ib);
  });
  const ids = ordered.map((c) => c.id);
  const moveTo = (id: string, target: number) => {
    const next = ids.filter((x) => x !== id);
    next.splice(Math.max(0, Math.min(target, next.length)), 0, id);
    setLayout(layoutKey, next);
  };
  return (
    <div className={'dashboard-visuals' + (unlocked ? ' layout-unlocked' : '')}>
      <div className="layout-toolbar">
        {unlocked && (
          <span className="layout-hint">
            Glissez les graphiques ou utilisez les flèches pour les réorganiser.
          </span>
        )}
        {unlocked && saved.length > 0 && (
          <button type="button" className="text-btn" onClick={() => setLayout(layoutKey, [])}>
            Disposition d’origine
          </button>
        )}
        <button
          type="button"
          className={'layout-lock' + (unlocked ? ' open' : '')}
          aria-pressed={unlocked}
          title={
            unlocked ? 'Verrouiller la disposition' : 'Déverrouiller pour déplacer les graphiques'
          }
          onClick={() => setUnlocked(!unlocked)}
        >
          {unlocked ? <LockOpen size={15} /> : <Lock size={15} />}
          {unlocked ? 'Verrouiller la disposition' : 'Déplacer les graphiques'}
        </button>
      </div>
      <div className="visual-grid">
        {ordered.map((c, i) => (
          <div
            key={c.id}
            data-card={c.id}
            className={
              'visual-slot' + (c.wide ? ' wide' : '') + (dragged === c.id ? ' dragging' : '')
            }
            draggable={unlocked}
            onDragStart={(e) => {
              setDragged(c.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => setDragged(null)}
            onDragOver={(e) => {
              if (unlocked && dragged) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragged && dragged !== c.id) moveTo(dragged, i);
              setDragged(null);
            }}
          >
            {unlocked && (
              <div className="slot-controls">
                <span className="slot-grip" aria-hidden="true">
                  <GripVertical size={15} />
                </span>
                <button
                  type="button"
                  aria-label="Avancer ce graphique"
                  disabled={i === 0}
                  onClick={() => moveTo(c.id, i - 1)}
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Reculer ce graphique"
                  disabled={i === ordered.length - 1}
                  onClick={() => moveTo(c.id, i + 1)}
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            {c.node}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsDashboard({
  records,
  members,
  period,
  onPeriod,
  onExport,
  onStatus,
  toolbar,
}: AnalyticsDashboardProps) {
  const rows = records.filter((r) => inPeriod(r.created, period));
  const d = buildDashboardData(rows, members);
  return (
    <>
      {toolbar}
      {!toolbar && (
        <div className="analytics-filter">
          <label>
            Période d’ouverture
            <PeriodPicker value={period} onChange={onPeriod} label="Période d’ouverture" />
          </label>
          <button className="secondary" onClick={() => onExport(rows)}>
            <ArrowUpRight size={15} />
            Exporter les dossiers filtrés
          </button>
        </div>
      )}
      <div className="analytics-summary">
        <div>
          <span className="summary-icon violet">
            <FolderOpen size={19} />
          </span>
          <small>Dossiers de la période</small>
          <strong>{d.total}</strong>
        </div>
        <div>
          <span className="summary-icon teal">
            <CheckCheck size={19} />
          </span>
          <small>Taux de résolution</small>
          <strong>
            {d.resolutionRate}
            <em>%</em>
          </strong>
        </div>
        <div>
          <span className="summary-icon blue">
            <Clock size={19} />
          </span>
          <small>Délais moyens · client / transporteur / dossier</small>
          <strong className="delay-trio">
            {days(d.delays.client.days)}
            <em> · </em>
            {days(d.delays.carrier.days)}
            <em> · </em>
            {days(d.delays.common.days)}
          </strong>
        </div>
        <div>
          <span className="summary-icon amber">
            <Wallet size={19} />
          </span>
          <small>Montant des avoirs</small>
          <strong>{formatMoney(d.creditTotal)}</strong>
        </div>
      </div>
      <DashboardVisuals
        records={rows}
        activityRecords={records}
        members={members}
        view="Admin"
        expanded
        onStatus={onStatus}
      />
      <div className="analytics-footnote">
        <Clock size={14} />
        <span>
          Les graphiques utilisent la date d’ouverture pour la période choisie, sauf « Le rythme des
          litiges » qui montre toujours les 14 derniers jours ou les 12 dernières semaines (avec les
          autres filtres). Délai client : de l’ouverture à la solution client définitive. Délai
          transporteur : de la transmission au transporteur à la clôture de son dossier. Délai
          dossier : de l’ouverture à la clôture. Les dossiers réouverts sont considérés comme
          ouverts.
        </span>
      </div>
    </>
  );
}
