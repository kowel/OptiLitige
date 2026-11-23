import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTreatmentRules, imputationFor, verdictOf } from '../app/treatment-rules.mjs';

const today = '2026-11-13';
const change = (prev, patch) => applyTreatmentRules(prev, { ...prev, ...patch }, today);

test('conclusion déduite du résultat', () => {
  assert.equal(verdictOf('Livraison conforme'), 'Non avéré');
  assert.equal(verdictOf('Fraude étiquette'), 'Non avéré');
  assert.equal(verdictOf('Colis perdu'), 'Avéré');
});

test('imputation proposée seulement quand elle est certaine', () => {
  assert.equal(imputationFor('Contestation de livraison'), 'Transporteur');
  assert.equal(imputationFor('Inversion'), 'Interne');
  assert.equal(imputationFor('Produit d’occasion'), 'Interne');
  assert.equal(imputationFor('Fraude mauvais produit reçu'), 'Autre');
  // Peut venir de chez nous comme du transporteur : à choisir
  assert.equal(imputationFor('Colis perdu'), '');
  assert.equal(imputationFor('Retard de livraison express'), '');
});

test('résultat → imputation, sans écraser un choix de l’agent', () => {
  const base = {
    outcome: '',
    imputation: '',
    carrierDecision: '',
    carrierStatus: 'En attente réponse',
  };
  const a = change(base, { outcome: 'Inversion' });
  assert.equal(a.imputation, 'Interne');
  // Changement de résultat : la proposition suit
  const b = change(a, { outcome: 'Contestation de livraison' });
  assert.equal(b.imputation, 'Transporteur');
  // L'agent a choisi lui-même : on garde
  const c = change(
    { ...base, outcome: 'Colis perdu', imputation: 'Interne' },
    { outcome: 'Logistique' },
  );
  assert.equal(c.imputation, 'Interne');
});

test('imputation interne ou autre : ne concerne pas le transporteur, dossier transporteur clos', () => {
  const base = { imputation: '', carrierDecision: '', carrierStatus: 'Envoyé au transporteur' };
  const r = change(base, { imputation: 'Interne' });
  assert.equal(r.carrierDecision, 'Ne concerne pas le transporteur');
  assert.equal(r.carrierStatus, 'Clos');
  // Retour à « Transporteur » : la décision redevient à saisir
  const back = change(r, { imputation: 'Transporteur' });
  assert.equal(back.carrierDecision, '');
  // Une vraie décision déjà saisie n'est pas remplacée
  const kept = change({ ...base, carrierDecision: 'Refusé' }, { imputation: 'Interne' });
  assert.equal(kept.carrierDecision, 'Refusé');
});

test('décision saisie : réponse reçue, datée du jour si vide', () => {
  const r = change(
    { carrierDecision: '', carrierStatus: 'En attente réponse', carrierReplyAt: '' },
    { carrierDecision: 'Accepté' },
  );
  assert.equal(r.carrierStatus, 'Réponse reçue');
  assert.equal(r.carrierReplyAt, today);
  const dated = change(
    { carrierDecision: '', carrierStatus: 'Clos', carrierReplyAt: '2026-10-02' },
    { carrierDecision: 'Partiel' },
  );
  assert.equal(dated.carrierStatus, 'Clos');
  assert.equal(dated.carrierReplyAt, '2026-10-02');
});

test('règles annulées proprement : retour au transporteur, dossier transporteur rouvert', () => {
  // Inversion propose Interne → « Ne concerne pas » + Clos ; Colis perdu retire la proposition
  const base = {
    outcome: '',
    imputation: '',
    carrierDecision: '',
    carrierStatus: 'Envoyé au transporteur',
    carrierSentAt: '2026-11-01',
  };
  const inv = change(base, { outcome: 'Inversion' });
  assert.equal(inv.carrierDecision, 'Ne concerne pas le transporteur');
  assert.equal(inv.carrierStatus, 'Clos');
  const lost = change(inv, { outcome: 'Colis perdu' });
  assert.equal(lost.imputation, '');
  assert.equal(lost.carrierDecision, '');
  assert.equal(lost.carrierStatus, 'En attente réponse');
  // Sans transmission : retour à « À transmettre »
  const noSend = change({ ...inv, carrierSentAt: '' }, { imputation: 'Transporteur' });
  assert.equal(noSend.carrierStatus, 'À transmettre');
});
