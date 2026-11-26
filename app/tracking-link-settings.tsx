'use client';
import { useState } from 'react';
import { Check, PackageSearch } from 'lucide-react';

// Paramètres → Liens de suivi : adresse de la page de suivi de chaque transporteur, avec
// {numero} à la place du numéro de suivi. Réservé aux responsables, comme toute la page.
export default function TrackingLinkSettings({
  links,
  carriers,
  busy,
  onSave,
}: {
  links: Record<string, string>;
  carriers: string[];
  busy: boolean;
  onSave: (links: Record<string, string>) => Promise<unknown>;
}) {
  const names = [...new Set([...carriers.map((c) => c.toUpperCase()), ...Object.keys(links)])];
  const [draft, setDraft] = useState<Record<string, string>>({ ...links });
  return (
    <section className="panel settings-panel tracking-link-settings">
      <div className="integration-icon">
        <PackageSearch size={24} />
      </div>
      <h2>Liens de suivi des colis</h2>
      <p>
        Dans chaque dossier, le bouton « Page du transporteur » ouvre la page de suivi du
        transporteur avec le numéro du champ BT. Écrivez <code>{'{numero}'}</code> à l’endroit où
        doit aller le numéro ; sans lui (espace client France Express par exemple), la page s’ouvre
        et le numéro se colle à la main. Laissez vide si le transporteur n’a pas de page de suivi.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(draft);
        }}
      >
        {names.map((c) => (
          <label key={c}>
            {c}
            <input
              type="url"
              placeholder="https://…{numero}"
              value={draft[c] || ''}
              onChange={(e) => setDraft({ ...draft, [c]: e.target.value })}
            />
          </label>
        ))}
        <button disabled={busy} className="primary">
          <Check size={16} />
          Enregistrer les liens
        </button>
      </form>
    </section>
  );
}
