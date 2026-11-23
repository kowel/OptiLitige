import test from 'node:test';
import assert from 'node:assert/strict';
import { applyInfoEdit, changesText } from '../app/edit-info.mjs';

const record = {
  title: 'Transport · commande 5700783',
  order: '5700783',
  disputeValue: 243497,
  customer: 'Non renseigné (import)',
  brand: 'CYBERTEK',
  store: '',
  productType: 'PC',
  origin: 'Transport',
  carrier: 'CHRONOPOST',
  type: 'Transport',
  priority: 'Normale',
  description: 'Le livreur a demandé un code',
};

test('correction du montant et de la commande, notée avant → après', () => {
  const { values, changes, error } = applyInfoEdit(record, {
    ...record,
    disputeValue: '2434,97',
    order: '5700784',
  });
  assert.equal(error, undefined);
  assert.equal(values.disputeValue, 2434.97);
  assert.deepEqual(
    changes.map((c) => c.key),
    ['order', 'disputeValue'],
  );
  const text = changesText(changes);
  assert.match(text, /Référence commande : 5700783 → 5700784/);
  assert.match(text, /Montant concerné par le litige : 243\s497,00\s€ → 2\s434,97\s€/);
});

test('aucun changement : rien à noter', () => {
  assert.deepEqual(applyInfoEdit(record, { ...record }).changes, []);
});

test('contrôles : montant, champs obligatoires, magasin', () => {
  assert.match(applyInfoEdit(record, { disputeValue: '-5' }).error, /Montant/);
  assert.match(applyInfoEdit(record, { disputeValue: '' }).error, /Montant/);
  assert.match(applyInfoEdit(record, { order: '  ' }).error, /obligatoire/);
  assert.match(applyInfoEdit(record, { origin: 'Ailleurs' }).error, /Origine/);
  assert.match(applyInfoEdit(record, { brand: 'MAGASIN' }).error, /magasin/);
  const ok = applyInfoEdit(record, { brand: 'MAGASIN', store: 'NANTES' });
  assert.equal(ok.values.store, 'NANTES');
  // Quitter l'enseigne MAGASIN efface le magasin
  const back = applyInfoEdit(
    { ...record, brand: 'MAGASIN', store: 'NANTES' },
    { brand: 'GROSBILL' },
  );
  assert.equal(back.values.store, '');
});
