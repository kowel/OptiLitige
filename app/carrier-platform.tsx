'use client';
import { useState } from 'react';
import { Check, ClipboardCopy, ExternalLink, Truck } from 'lucide-react';
import { claimFormFor, claimSummary } from './claim-forms.mjs';
import type { ClaimForm, Dossier } from './types';

interface CarrierPlatformProps {
  record: Dossier;
  canEdit: boolean;
  /** Formulaires de réclamation (Paramètres → Transporteurs) */
  forms: Record<string, ClaimForm>;
}

// « Formulaire de réclamation » (onglet Transporteur d'un dossier) : ouvre le formulaire du
// service client du transporteur réglé dans Paramètres → Transporteurs, avec le n° de compte et
// le résumé du litige à copier. Aucun transporteur n'offre d'API de réclamation : si un jour
// c'est le cas, la demande et sa réponse pourront passer directement par ici.
export default function CarrierPlatform({ record, canEdit, forms }: CarrierPlatformProps) {
  const [copied, setCopied] = useState('');
  if (record.origin !== 'Transport') return null;
  const carrier = record.carrier || 'Transporteur non renseigné';
  const form = claimFormFor(forms, record.carrier);
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2500);
    } catch {
      window.prompt('Copiez le texte :', text);
    }
  };
  return (
    <section className="carrier-platform" aria-label={'Formulaire de réclamation ' + carrier}>
      <div className="carrier-platform-head">
        <span className="carrier-platform-icon">
          <Truck size={18} />
        </span>
        <div>
          <strong>Réclamation {carrier}</strong>
          <small>Formulaire du service client du transporteur</small>
        </div>
        {form?.url ? (
          <span className="badge">Formulaire en ligne</span>
        ) : (
          <span className="badge pending">À régler dans Paramètres → Transporteurs</span>
        )}
      </div>
      {form?.note && <p className="carrier-platform-note">{form.note}</p>}
      {canEdit ? (
        <div className="carrier-platform-actions">
          {form?.url && (
            <a className="primary" href={form.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} /> Ouvrir le formulaire {carrier}
            </a>
          )}
          {form?.account && (
            <button
              type="button"
              className="secondary"
              onClick={() => copy('account', form.account)}
            >
              {copied === 'account' ? <Check size={15} /> : <ClipboardCopy size={15} />} N° de
              compte : {form.account}
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => copy('summary', claimSummary(record))}
          >
            {copied === 'summary' ? <Check size={15} /> : <ClipboardCopy size={15} />}
            {copied === 'summary' ? 'Résumé copié' : 'Copier le résumé du litige'}
          </button>
        </div>
      ) : (
        <p className="muted">La réclamation au transporteur est faite par le Service Litige.</p>
      )}
      <small className="muted">
        Une fois la réclamation déposée, notez sa référence et la date de transmission dans le
        traitement : les relances se programment seules. Si le service client tarde, écrivez au
        commercial avec « Écrire un e-mail » ci-dessous.
      </small>
    </section>
  );
}
