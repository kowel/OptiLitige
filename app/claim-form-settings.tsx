'use client';
import { useState } from 'react';
import { Check, ClipboardList } from 'lucide-react';

type ClaimForm = { url: string; account: string; note: string };

// Paramètres → Transporteurs → Formulaires de réclamation : pour chaque transporteur, l'adresse
// du formulaire de son service client (ou de l'espace pro), le n° de compte client et une
// consigne. Le bouton « Ouvrir le formulaire » de l'onglet Transporteur d'un dossier s'en sert.
export default function ClaimFormSettings({
  forms,
  carriers,
  busy,
  onSave,
}: {
  forms: Record<string, ClaimForm>;
  carriers: string[];
  busy: boolean;
  onSave: (forms: Record<string, ClaimForm>) => Promise<unknown>;
}) {
  const names = [...new Set([...carriers.map((c) => c.toUpperCase()), ...Object.keys(forms)])];
  const [draft, setDraft] = useState<Record<string, ClaimForm>>(
    Object.fromEntries(
      names.map((c) => [
        c,
        { url: forms[c]?.url || '', account: forms[c]?.account || '', note: forms[c]?.note || '' },
      ]),
    ),
  );
  const set = (c: string, patch: Partial<ClaimForm>) =>
    setDraft({ ...draft, [c]: { ...draft[c], ...patch } });
  return (
    <section className="panel settings-panel claim-form-settings">
      <div className="integration-icon">
        <ClipboardList size={24} />
      </div>
      <h2>Formulaires de réclamation</h2>
      <p>
        Adresse du formulaire de réclamation (ou de l’espace professionnel) de chaque transporteur,
        n° de compte client et consigne pour l’équipe. Dans l’onglet Transporteur d’un dossier, le
        Service Litige ouvre ce formulaire et copie le résumé du litige pour le coller. Aucun
        transporteur ne propose aujourd’hui d’API de réclamation : la réponse se note dans le
        traitement du dossier. N’écrivez jamais de mot de passe ici.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(draft);
        }}
      >
        {names.map((c) => (
          <fieldset key={c} className="claim-form-carrier">
            <legend>{c}</legend>
            <label>
              Adresse du formulaire
              <input
                type="url"
                placeholder="https://…"
                value={draft[c].url}
                onChange={(e) => set(c, { url: e.target.value })}
              />
            </label>
            <label>
              N° de compte client
              <input
                maxLength={80}
                value={draft[c].account}
                onChange={(e) => set(c, { account: e.target.value })}
              />
            </label>
            <label className="span2">
              Consigne (pièces à joindre, délai de déclaration…)
              <input
                maxLength={500}
                value={draft[c].note}
                onChange={(e) => set(c, { note: e.target.value })}
              />
            </label>
          </fieldset>
        ))}
        <button disabled={busy} className="primary">
          <Check size={16} />
          Enregistrer les formulaires
        </button>
      </form>
    </section>
  );
}
