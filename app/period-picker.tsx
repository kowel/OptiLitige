'use client';
import { PERIOD_PRESETS, customPeriod, parisDay, parsePeriod } from './period.mjs';

interface PeriodPickerProps {
  value: string;
  onChange: (period: string) => void;
  label?: string;
}

// Choix de la période : préréglages ou « Dates personnalisées » (du … au …).
export default function PeriodPicker({ value, onChange, label }: PeriodPickerProps) {
  const p = parsePeriod(value);
  const custom = p.kind === 'custom';
  return (
    <span className="period-picker">
      <select
        aria-label={label || 'Période'}
        value={custom ? 'custom' : String(value)}
        onChange={(e) => {
          if (e.target.value !== 'custom') return onChange(e.target.value);
          // Par défaut : du 1er du mois en cours à aujourd'hui
          const today = parisDay(new Date().toISOString());
          onChange(customPeriod(today.slice(0, 8) + '01', today));
        }}
      >
        {PERIOD_PRESETS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
        <option value="custom">Dates personnalisées…</option>
      </select>
      {custom && (
        <span className="period-dates">
          <label>
            Du
            <input
              type="date"
              aria-label="Date de début"
              value={p.from}
              max={p.to || undefined}
              onChange={(e) => onChange(customPeriod(e.target.value, p.to))}
            />
          </label>
          <label>
            au
            <input
              type="date"
              aria-label="Date de fin"
              value={p.to}
              min={p.from || undefined}
              onChange={(e) => onChange(customPeriod(p.from, e.target.value))}
            />
          </label>
        </span>
      )}
    </span>
  );
}
