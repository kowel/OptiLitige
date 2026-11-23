'use client';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { EDITABLE_FIELDS, STORE_BRAND } from './edit-info.mjs';
import { stakeOf } from './advanced-filters.mjs';
import type { Dossier } from './types';

interface EditInfoFormProps {
  record: Dossier;
  lists: {
    brands: string[];
    stores: string[];
    products: string[];
    carriers: string[];
    types: string[];
  };
  busy: boolean;
  onSave: (info: Record<string, string | number>) => Promise<boolean>;
}

// Liste proposée, en gardant la valeur actuelle si elle n'y figure pas (valeur reprise de
// SharePoint, ancienne catégorie…)
const withCurrent = (list: string[], current: unknown) => {
  const v = String(current ?? '');
  return v && !list.includes(v) ? [v, ...list] : list;
};

// Fenêtre « Modifier les informations » d'un dossier (responsables) : corriger un montant, un
// n° de commande, une enseigne… Chaque changement est noté dans l'historique du dossier.
export default function EditInfoForm({ record, lists, busy, onSave }: EditInfoFormProps) {
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      EDITABLE_FIELDS.map(([key]) => [
        key,
        // Montant concerné : celui affiché dans la fiche (montant de commande des anciens
        // dossiers qui n'en ont pas)
        key === 'disputeValue'
          ? String(stakeOf(record))
          : String((record as unknown as Record<string, unknown>)[key] ?? ''),
      ]),
    ),
  );
  const set = (key: string, value: string) => setF({ ...f, [key]: value });
  const input = (key: string, label: string, extra: Record<string, unknown> = {}) => (
    <label>
      {label}
      <input value={f[key]} onChange={(e) => set(key, e.target.value)} {...extra} />
    </label>
  );
  const select = (key: string, label: string, options: string[], required = true) => (
    <label>
      {label}
      {required ? ' *' : ''}
      <select required={required} value={f[key]} onChange={(e) => set(key, e.target.value)}>
        {!required && <option value="">—</option>}
        {withCurrent(options, f[key]).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <span className="eyebrow">RESPONSABLES · CORRECTION</span>
      <h2>Modifier les informations</h2>
      <p>
        {record.ref} · chaque modification est enregistrée dans l’historique du dossier (ancienne et
        nouvelle valeur).
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave({ ...f, amount: Number(String(f.amount).replace(',', '.')) });
        }}
      >
        <div className="form-grid">
          <label className="span2">
            Objet du litige *
            <input
              required
              maxLength={200}
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </label>
          {input('order', 'Référence commande *', { required: true, maxLength: 100 })}
          {input('disputeValue', 'Montant concerné par le litige (€) *', {
            required: true,
            type: 'number',
            min: '0',
            step: '0.01',
          })}
          {input('customerAccount', 'Numéro de compte client', { maxLength: 60 })}
          {input('customer', 'Nom du client', { maxLength: 150 })}
          {select('brand', 'Enseigne', lists.brands)}
          {f.brand === STORE_BRAND && select('store', 'Magasin', lists.stores)}
          {select('productType', 'Type de produit', lists.products)}
          {input('productRef', 'Référence produit', { maxLength: 200 })}
          {input('ticket', 'Numéro de ticket', { maxLength: 200 })}
          {input('bt', 'BT', { maxLength: 200 })}
          {input('requester', 'Demandeur', { maxLength: 200 })}
          {select('origin', 'Origine', ['Transport', 'Interne'])}
          {f.origin === 'Transport' && select('carrier', 'Transporteur', lists.carriers, false)}
          {select('type', 'Type à l’ouverture', lists.types)}
          {select('priority', 'Priorité', ['Normale', 'Haute'])}
          <label className="span2">
            Description *
            <textarea
              required
              rows={4}
              maxLength={10000}
              value={f.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>
        </div>
        <div className="modal-footer">
          <span>Le numéro de dossier et l’historique ne changent pas.</span>
          <button disabled={busy} className="primary">
            <Check size={16} />
            {busy ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </>
  );
}
