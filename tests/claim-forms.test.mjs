import test from 'node:test';
import assert from 'node:assert/strict';
import { claimFormFor, claimSummary, normalizeClaimForms } from '../app/claim-forms.mjs';

test('Formulaires de réclamation : adresses https, compte et consigne', () => {
  const { forms } = normalizeClaimForms({
    chronopost: {
      url: ' https://www.chronopost.fr/fr/reclamation ',
      account: ' 12345 ',
      note: 'PJ',
    },
    TNT: { url: '', account: '', note: '' }, // vide : non gardé
  });
  assert.deepEqual(forms, {
    CHRONOPOST: { url: 'https://www.chronopost.fr/fr/reclamation', account: '12345', note: 'PJ' },
  });
  assert.match(normalizeClaimForms({ X: { url: 'http://a.fr' } }).error, /https/);
  assert.match(normalizeClaimForms({ X: { url: 'pas une adresse' } }).error, /invalide/);
  assert.deepEqual(normalizeClaimForms(null).forms, {});
});

test('Formulaire du transporteur du dossier et résumé à coller', () => {
  const forms = { CHRONOPOST: { url: 'https://x.fr', account: '1', note: '' } };
  assert.equal(claimFormFor(forms, 'Chronopost').url, 'https://x.fr');
  assert.equal(claimFormFor(forms, 'TNT'), null);
  const text = claimSummary({
    ref: 'IMP-1',
    order: '6550963',
    bt: 'XA123456789FR',
    customer: 'Non renseigné (import)',
    type: 'Transport',
    disputeValue: 3000,
    description: 'Colis perdu',
  });
  assert.equal(
    text,
    'Référence Cybertek : IMP-1\nN° de commande : 6550963\nN° de suivi : XA123456789FR\n' +
      'Type de litige : Transport\nValeur : 3000,00 €\nDescription : Colis perdu',
  );
});
