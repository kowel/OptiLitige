'use client';
import { useState } from 'react';
import { Bookmark, Check, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { EMPTY_ADVANCED, MAX_VIEWS, SOURCE_LABELS, countAdvanced } from './advanced-filters.mjs';
import type { AdvancedFilters, ListFilters, SavedView } from './types';

interface ListToolsProps {
  adv: AdvancedFilters;
  setAdv: (adv: AdvancedFilters) => void;
  options: { brands: string[]; carriers: string[]; types: string[]; products: string[] };
  views: SavedView[];
  current: ListFilters;
  onApply: (filters: Partial<ListFilters>) => void;
  onAddView: (view: { name: string; filters: ListFilters }) => Promise<boolean>;
  onDeleteView: (id: string) => unknown;
  team: string;
  busy: boolean;
}

// « Plus de filtres » et « Mes vues » au-dessus de la liste des dossiers.
// current : filtres actuels de la liste (recherche, statut, origine, périmètre, période,
// filtres avancés) ; onApply(filters) les remplace. Les vues sont partagées par service :
// visibles et modifiables par tous les comptes du même rôle (team = nom du service).
export default function ListTools({
  adv,
  setAdv,
  options,
  views,
  current,
  onApply,
  onAddView,
  onDeleteView,
  team,
  busy,
}: ListToolsProps) {
  const [open, setOpen] = useState(countAdvanced(adv) > 0),
    [naming, setNaming] = useState(false),
    [name, setName] = useState('');
  const count = countAdvanced(adv);
  const set = (k: keyof AdvancedFilters, v: string) => setAdv({ ...adv, [k]: v });
  const select = (
    k: keyof AdvancedFilters,
    label: string,
    list: string[],
    labels?: Record<string, string>,
  ) => (
    <label>
      {label}
      <select value={adv[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">Tous</option>
        {list.map((v) => (
          <option key={v} value={v}>
            {labels?.[v] || v}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="list-tools">
      <div className="list-tools-bar">
        <button
          type="button"
          className={'secondary' + (count ? ' has-filters' : '')}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={15} /> Plus de filtres{count ? ' (' + count + ')' : ''}
        </button>
        {count > 0 && (
          <button type="button" className="text-btn" onClick={() => setAdv({ ...EMPTY_ADVANCED })}>
            <X size={13} /> Effacer les filtres avancés
          </button>
        )}
        <span className="list-tools-views">
          <Bookmark size={15} />
          <select
            aria-label="Mes vues"
            value=""
            onChange={(e) => {
              const v = views.find((x) => x.id === e.target.value);
              if (v) {
                onApply(v.filters);
                setOpen(countAdvanced(v.filters.adv) > 0);
              }
            }}
          >
            <option value="">
              {views.length ? 'Vues ' + team + '…' : 'Aucune vue pour ' + team}
            </option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {naming ? (
            <form
              className="list-tools-save"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                if (await onAddView({ name: name.trim(), filters: current })) {
                  setNaming(false);
                  setName('');
                }
              }}
            >
              <input
                autoFocus
                maxLength={60}
                placeholder="Nom de la vue (ex. DPD > 500 €)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="primary" disabled={busy || !name.trim()}>
                <Check size={14} /> Enregistrer
              </button>
              <button type="button" className="text-btn" onClick={() => setNaming(false)}>
                Annuler
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="text-btn"
              disabled={views.length >= MAX_VIEWS}
              onClick={() => setNaming(true)}
            >
              Enregistrer cette vue pour {team}
            </button>
          )}
        </span>
      </div>

      {open && (
        <div className="advanced-filters">
          {select('brand', 'Enseigne', options.brands)}
          {select('carrier', 'Transporteur', options.carriers)}
          {select('type', 'Type de litige', options.types)}
          {select('productType', 'Type de produit', options.products)}
          {select('source', 'Créé par', Object.keys(SOURCE_LABELS), SOURCE_LABELS)}
          <label>
            Montant mini (€)
            <input
              type="number"
              min="0"
              value={adv.min}
              onChange={(e) => set('min', e.target.value)}
            />
          </label>
          <label>
            Montant maxi (€)
            <input
              type="number"
              min="0"
              value={adv.max}
              onChange={(e) => set('max', e.target.value)}
            />
          </label>
          <label>
            Avoir
            <select value={adv.credit} onChange={(e) => set('credit', e.target.value)}>
              <option value="">Tous</option>
              <option value="with">Avec un avoir</option>
              <option value="without">Sans avoir</option>
            </select>
          </label>
        </div>
      )}

      {views.length > 0 && (
        <details className="views-manage">
          <summary>
            Vues partagées · {team} ({views.length})
          </summary>
          <ul>
            {views.map((v) => (
              <li key={v.id}>
                <button type="button" className="text-btn" onClick={() => onApply(v.filters)}>
                  {v.name}
                </button>
                {v.createdByName && <small>par {v.createdByName}</small>}
                <button
                  type="button"
                  aria-label={'Supprimer la vue ' + v.name}
                  title="Supprimer"
                  disabled={busy}
                  onClick={() =>
                    window.confirm(
                      'Supprimer la vue « ' + v.name + ' » pour tout le service ' + team + ' ?',
                    ) && onDeleteView(v.id)
                  }
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
