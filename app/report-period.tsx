'use client';
import { monthPeriod } from './reports.mjs';

export interface ReportPeriodValue {
  kind: 'monthly' | 'weekly' | 'range';
  periodKey: string;
  from?: string;
  to?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

// Choix de la période du rapport : un mois, ou des dates (du … au …)
export default function ReportPeriod({
  value,
  onChange,
  error,
}: {
  value: ReportPeriodValue;
  onChange: (v: ReportPeriodValue) => void;
  error?: string;
}) {
  const months = Array.from({ length: 25 }, (_, k) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - k);
    return { key: d.getFullYear() + '-' + pad(d.getMonth() + 1), current: k === 0 };
  });
  const range = value.kind === 'range';
  return (
    <div className="report-period">
      <div className="scale-toggle" role="group" aria-label="Type de période">
        <button
          type="button"
          aria-pressed={!range}
          className={!range ? 'active' : ''}
          onClick={() =>
            onChange({
              ...value,
              kind: 'monthly',
              periodKey: /^\d{4}-\d{2}$/.test(value.periodKey) ? value.periodKey : months[1].key,
            })
          }
        >
          {value.kind === 'weekly' ? 'Semaine' : 'Par mois'}
        </button>
        <button
          type="button"
          aria-pressed={range}
          className={range ? 'active' : ''}
          onClick={() =>
            onChange({
              ...value,
              kind: 'range',
              from: value.from || today().slice(0, 8) + '01',
              to: value.to || today(),
            })
          }
        >
          Par dates
        </button>
      </div>
      {value.kind === 'monthly' && (
        <label>
          Mois
          <select
            value={value.periodKey}
            onChange={(e) => onChange({ ...value, periodKey: e.target.value })}
          >
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {monthPeriod(m.key).label + (m.current ? ' (en cours)' : '')}
              </option>
            ))}
          </select>
        </label>
      )}
      {range && (
        <>
          <label>
            Du
            <input
              type="date"
              value={value.from || ''}
              max={value.to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </label>
          <label>
            au
            <input
              type="date"
              value={value.to || ''}
              min={value.from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </label>
        </>
      )}
      {error && (
        <span className="report-period-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
