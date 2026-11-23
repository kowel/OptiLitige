import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CREDIT_SETTINGS,
  applyCreditAction,
  creditPermissions,
  needsManager,
  normalizeCreditSettings,
  openCredits,
  suggestCredit,
} from '../app/credit-requests.mjs';

const rc = { email: 'rc@x.fr', name: 'RC', role: 'RC' };
const litige = { email: 'li@x.fr', name: 'Litige', role: 'Service Litige' };
const chef = { email: 'chef@x.fr', name: 'Chef', role: 'Admin' };
const now = '2026-11-06T10:00:00.000Z';
const today = '2026-11-06';
const request = (over = {}) => ({
  family: 'legal',
  reason: 'Produit endommagé à la livraison',
  kind: 'partial',
  imputation: 'Transporteur',
  amount: 89.9,
  comment: 'Écran rayé',
  ...over,
});
// Seuil de validation facultatif (désactivé par défaut) : réglé à 150 € pour le tester
const WITH_THRESHOLD = {
  ...DEFAULT_CREDIT_SETTINGS,
  managerAbove: { legal: null, commercial: 150, fees: null },
};
const run = (r, b, who, settings = DEFAULT_CREDIT_SETTINGS) =>
  applyCreditAction(r, { newId: 'c' + (r.credits?.length || 0), ...b }, who, settings, now, today);

test('Motif proposé d’après le type du litige', () => {
  assert.deepEqual(suggestCredit('Livraison endommagé'), {
    family: 'legal',
    reason: 'Produit endommagé à la livraison',
    imputation: 'Transporteur',
  });
  assert.equal(suggestCredit('Retard de livraison classique').family, 'commercial');
  assert.equal(suggestCredit('Type inconnu').family, 'commercial');
});

test('Circuit complet : demande, acceptation, émission dans l’ERP', () => {
  const r = { amount: 500, history: [] };
  assert.equal(
    run(r, { action: 'credit-request', request: request() }, rc).message,
    'Demande d’avoir envoyée',
  );
  assert.equal(r.credits[0].status, 'requested');
  // La RC ne peut pas valider
  assert.equal(
    run(r, { action: 'credit-decision', creditId: 'c0', decision: 'accept' }, rc).status,
    403,
  );
  assert.equal(
    run(r, { action: 'credit-decision', creditId: 'c0', decision: 'accept', amount: 80 }, litige)
      .message,
    'Demande acceptée',
  );
  assert.equal(r.credits[0].approvedAmount, 80);
  assert.equal(run(r, { action: 'credit-issue', creditId: 'c0', number: '' }, litige).status, 400);
  assert.equal(
    run(r, { action: 'credit-issue', creditId: 'c0', number: 'AV-1', date: '' }, litige).message,
    'Avoir enregistré',
  );
  assert.equal(r.credits[0].status, 'issued');
  assert.equal(r.creditNumber, 'AV-1');
  assert.equal(r.credit, 80);
  assert.equal(r.creditIssued, true);
  assert.equal(r.creditCreated, today);
  assert.equal(r.history.length, 3);
  // Second avoir sur le même dossier : cumulé
  run(r, { action: 'credit-request', request: request({ amount: 20 }) }, rc);
  run(r, { action: 'credit-decision', creditId: 'c1', decision: 'accept' }, litige);
  run(r, { action: 'credit-issue', creditId: 'c1', number: 'AV-2', date: '2026-11-07' }, litige);
  assert.equal(r.creditNumber, 'AV-1 / AV-2');
  assert.equal(r.credit, 100);
  assert.equal(r.creditCreated, today);
});

test('Par défaut, aucun avoir ne passe par un responsable', () => {
  assert.equal(needsManager('commercial', 5000), false);
  assert.equal(needsManager('legal', 5000), false);
  const r = { amount: 900 };
  run(
    r,
    {
      action: 'credit-request',
      request: request({ family: 'commercial', reason: 'Retard de livraison', amount: 800 }),
    },
    rc,
  );
  assert.equal(r.credits[0].status, 'requested');
  assert.equal(
    run(r, { action: 'credit-decision', creditId: 'c0', decision: 'accept' }, litige).message,
    'Demande acceptée',
  );
});

test('Seuil réglé (facultatif) : validation par un responsable au-delà', () => {
  assert.equal(needsManager('commercial', 150, WITH_THRESHOLD), false);
  assert.equal(needsManager('commercial', 150.01, WITH_THRESHOLD), true);
  assert.equal(needsManager('legal', 5000, WITH_THRESHOLD), false);
  const r = { amount: 900 };
  run(
    r,
    {
      action: 'credit-request',
      request: request({ family: 'commercial', reason: 'Retard de livraison', amount: 200 }),
    },
    rc,
    WITH_THRESHOLD,
  );
  assert.equal(r.credits[0].status, 'manager');
  assert.equal(
    run(
      r,
      { action: 'credit-decision', creditId: 'c0', decision: 'accept' },
      litige,
      WITH_THRESHOLD,
    ).status,
    403,
  );
  // Le service litige peut refuser, avec un motif
  assert.equal(
    run(
      r,
      { action: 'credit-decision', creditId: 'c0', decision: 'refuse' },
      litige,
      WITH_THRESHOLD,
    ).status,
    400,
  );
  assert.equal(
    run(r, { action: 'credit-decision', creditId: 'c0', decision: 'accept' }, chef, WITH_THRESHOLD)
      .message,
    'Demande acceptée',
  );

  // Montant augmenté par le service litige au-delà du seuil : transmis à un responsable
  const r2 = { amount: 900 };
  run(
    r2,
    {
      action: 'credit-request',
      request: request({ family: 'commercial', reason: 'Retard de livraison', amount: 100 }),
    },
    rc,
    WITH_THRESHOLD,
  );
  assert.equal(r2.credits[0].status, 'requested');
  assert.equal(
    run(
      r2,
      { action: 'credit-decision', creditId: 'c0', decision: 'accept', amount: 300 },
      litige,
      WITH_THRESHOLD,
    ).message,
    'Demande transmise à un admin',
  );
  assert.equal(r2.credits[0].status, 'manager');
});

test('Refus, annulation et demandes en cours', () => {
  const r = { amount: 500 };
  run(r, { action: 'credit-request', request: request() }, rc);
  run(r, { action: 'credit-request', request: request({ amount: 10 }) }, rc);
  assert.equal(openCredits(r).length, 2);
  assert.equal(
    run(
      r,
      { action: 'credit-decision', creditId: 'c0', decision: 'refuse', comment: 'Hors garantie' },
      litige,
    ).message,
    'Demande refusée',
  );
  assert.equal(run(r, { action: 'credit-cancel', creditId: 'c1' }, litige).status, 403); // pas l'auteur
  assert.equal(run(r, { action: 'credit-cancel', creditId: 'c1' }, rc).message, 'Demande annulée');
  assert.equal(openCredits(r).length, 0);
  assert.deepEqual(creditPermissions(r.credits[0], chef), {
    decide: false,
    refuse: false,
    issue: false,
    cancel: false,
  });
});

test('Demandes invalides refusées', () => {
  const r = { amount: 100 };
  assert.match(
    run(r, { action: 'credit-request', request: request({ amount: 0 }) }, rc).error,
    /supérieur à zéro/,
  );
  assert.match(
    run(r, { action: 'credit-request', request: request({ reason: 'Inventé' }) }, rc).error,
    /motif/,
  );
  assert.match(
    run(r, { action: 'credit-request', request: request({ amount: 1000 }) }, rc).error,
    /dépasse/,
  );
  assert.match(
    run(r, { action: 'credit-request', request: request({ imputation: 'X' }) }, rc).error,
    /imputation/,
  );
});

test('Réglages des responsables', () => {
  assert.deepEqual(
    normalizeCreditSettings(DEFAULT_CREDIT_SETTINGS).settings,
    DEFAULT_CREDIT_SETTINGS,
  );
  assert.match(
    normalizeCreditSettings({ ...DEFAULT_CREDIT_SETTINGS, reasons: { legal: [] } }).error,
    /motif/,
  );
  const s = normalizeCreditSettings({
    ...DEFAULT_CREDIT_SETTINGS,
    managerAbove: { legal: '', commercial: '99.999', fees: 0 },
  }).settings;
  assert.deepEqual(s.managerAbove, { legal: null, commercial: 100, fees: 0 });
  assert.match(
    normalizeCreditSettings({ ...DEFAULT_CREDIT_SETTINGS, managerAbove: { commercial: -1 } }).error,
    /Seuil/,
  );
});
