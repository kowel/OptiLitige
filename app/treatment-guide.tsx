'use client';
import { Check, ChevronUp, Route } from 'lucide-react';
import { setHelpOpen } from './help-tip';
import { SERVICE_LABELS, nextStep, treatmentSteps } from './treatment-steps.mjs';
import type { Dossier } from './types';

// Aide de la fiche (colonne de droite), masquable : voir app/help-tip.tsx
export const GUIDE_HELP = 'fiche-qui-fait-quoi';
const who = (roles: string[]) =>
  roles.map((r) => (SERVICE_LABELS as Record<string, string>)[r] || r).join(' · ');

// Badge « qui · quand » affiché au-dessus de chaque partie du formulaire de traitement
export function SectionHint({ who: roles, when }: { who: string[]; when: string }) {
  return (
    <p className="section-hint">
      <span className={'who-badge ' + (roles[0] === 'Service Litige' ? 'litige' : 'rc')}>
        {who(roles)}
      </span>
      <span>{when}</span>
    </p>
  );
}

// « Qui fait quoi, et quand » : les étapes du dossier, l'étape en cours et si c'est à vous
export default function TreatmentGuide({ record, role }: { record: Dossier; role: string }) {
  const steps = treatmentSteps(record);
  const { step, mine } = nextStep(record, role);
  return (
    <div className="treatment-guide">
      <div className="treatment-guide-head">
        <Route size={16} />
        <div>
          <b>Qui fait quoi, et quand</b>
          {step ? (
            <small className={mine ? 'is-mine' : undefined}>
              Étape en cours : {step.title} · {who(step.who)}
              {mine ? ' — c’est à vous' : ''}
            </small>
          ) : (
            <small>Dossier résolu : toutes les étapes sont faites.</small>
          )}
        </div>
        <button
          type="button"
          className="text-btn"
          onClick={() => setHelpOpen(GUIDE_HELP, false)}
          title="Masquer l’aide : plus de place pour le dossier et le traitement"
        >
          <ChevronUp size={15} /> Masquer l’aide
        </button>
      </div>
      {
        <ol>
          {steps.map((s, i) => (
            <li key={s.id} className={'step-' + s.state}>
              <span className="step-dot">
                {s.state === 'done' ? <Check size={11} /> : s.state === 'skip' ? '–' : i + 1}
              </span>
              <div>
                <b>
                  {s.title}
                  {s.state === 'skip' && (
                    <em>
                      {' '}
                      · sans objet (
                      {record.origin === 'Transport'
                        ? 'ne concerne pas le transporteur'
                        : 'litige interne'}
                      )
                    </em>
                  )}
                </b>
                <span className="step-who">{who(s.who)}</span>
                <small>
                  <strong>Quand :</strong> {s.when}
                </small>
                <small>
                  <strong>Quoi :</strong> {s.what}
                </small>
              </div>
            </li>
          ))}
        </ol>
      }
    </div>
  );
}
