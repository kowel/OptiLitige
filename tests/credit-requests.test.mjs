import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CREDIT_SETTINGS,
  applyCreditAction,
  canRequestCredit,
  creditPermissions,
  needsManager,
  normalizeCreditSettings,
  openCredits,
  suggestCredit,
} from '../app/credit-requests.mjs';

const rc = { email: 'rc@x.fr', name: 'RC', role: 'RC' };
const sav = { email: 'sav@x.fr', name: 'SAV', role: 'SAV' };
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
const NOTHING = { decide: false, refuse: false, issue: false, cancel: false };

test('Motif proposé d’après le type du litige', () => {
  assert.deepEqual(suggestCredit('Livraison endommagé'), {
    family: 'legal',
    reason: 'Produit endommagé à la livraison',
    imputation: 'Transporteur',
  });
  assert.equal(suggestCredit('Retard de livraison classique').family, 'commercial');
  assert.equal(suggestCredit('Type inconnu').family, 'commercial');
});

test('RC et SAV : lecture seule, aucune demande ni traitement', () => {
  const r = { amount: 500, history: [] };
  for (const who of [rc, sav]) {
    assert.equal(canRequestCredit(who), false);
    assert.equal(run(r, { action: 'credit-request', request: request() }, who).status, 403);
  }
  assert.equal(canRequestCredit(litige), true);
  assert.equal(canRequestCredit(chef), true);
  run(r, { action: 'credit-request', request: request() }, litige);
  assert.deepEqual(creditPermissions(r.credits[0], rc), NOTHING);
  assert.equal(run(r, { action: 'credit-issue', creditId: 'c0', number: 'AV-1' }, rc).status, 403);
  assert.equal(run(r, { action: 'credit-cancel', creditId: 'c0' }, sav).status, 403);
});

test('Service litige : demande puis émission en une étape (montant + n° d’avoir)', () => {
  const r = { amount: 500, history: [] };
  assert.equal(
    run(r, { action: 'credit-request', request: request() }, litige).message,
    'Demande d’avoir envoyée',
  );
  assert.equal(r.credits[0].status, 'requested');
  assert.equal(openCredits(r).length, 1);
  assert.equal(run(r, { action: 'credit-issue', creditId: 'c0', number: '' }, litige).status, 400);
  assert.equal(
    run(r, { action: 'credit-issue', creditId: 'c0', number: 'AV-1', amount: 0 }, litige).status,
    400,
  );
  assert.equal(
    run(
      r,
      { action: 'credit-issue', creditId: 'c0', number: 'AV-1', amount: 80, comment: 'OK client' },
      litige,
    ).message,
    'Avoir enregistré',
  );
  const c = r.credits[0];
  assert.equal(c.status, 'issued');
  assert.equal(c.approvedAmount, 80);
  assert.equal(c.decision.byName, 'Litige');
  assert.equal(c.decision.comment, 'OK client');
  assert.equal(c.issue.number, 'AV-1');
  assert.equal(r.creditNumber, 'AV-1');
  assert.equal(r.credit, 80);
  assert.equal(r.creditIssued, true);
  assert.equal(r.creditCreated, today);
  assert.equal(r.creditIssuedAt, now);
  assert.equal(r.history.length, 2);
  assert.equal(openCredits(r).length, 0);
  // Second avoir sur le même dossier, montant demandé gardé : cumulé
  run(r, { action: 'credit-request', request: request({ amount: 20 }) }, chef);
  run(r, { action: 'credit-issue', creditId: 'c1', number: 'AV-2', date: '2026-11-07' }, litige);
  assert.equal(r.credits[1].approvedAmount, 20);
  assert.equal(r.creditNumber, 'AV-1 / AV-2');
  assert.equal(r.credit, 100);
  assert.equal(r.creditCreated, today);
});

test('Demande acceptée avant le 26/11 (deux étapes) : toujours émise normalement', () => {
  const r = { amount: 500 };
  run(r, { action: 'credit-request', request: request() }, litige);
  assert.equal(
    run(r, { action: 'credit-decision', creditId: 'c0', decision: 'accept', amount: 70 }, litige)
      .message,
    'Demande acceptée',
  );
  assert.equal(r.credits[0].status, 'accepted');
  assert.equal(openCredits(r).length, 1);
  run(r, { action: 'credit-issue', creditId: 'c0', number: 'AV-9' }, litige);
  assert.equal(r.credits[0].status, 'issued');
  assert.equal(r.credit, 70);
});

test('Par défaut, aucun avoir ne passe par un admin', () => {
  assert.equal(needsManager('commercial', 5000), false);
  assert.equal(needsManager('legal', 5000), false);
  const r = { amount: 900 };
  run(
    r,
    {
      action: 'credit-request',
      request: request({ family: 'commercial', reason: 'Retard de livraison', amount: 800 }),
    },
    litige,
  );
  assert.equal(r.credits[0].status, 'requested');
  assert.equal(
    run(r, { action: 'credit-issue', creditId: 'c0', number: 'AV-3' }, litige).message,
    'Avoir enregistré',
  );
});

test('Seuil réglé (facultatif) : validation par un admin au-delà', () => {
  assert.equal(needsManager('commercial', 150, WITH_THRESHOLD), false);
  assert.equal(needsManager('commercial', 150.01, WITH_THRESHOLD), true);
  const big = request({ family: 'commercial', reason: 'Retard de livraison', amount: 200 });
  const r = { amount: 900 };
  run(r, { action: 'credit-request', request: big }, litige, WITH_THRESHOLD);
  assert.equal(r.credits[0].status, 'manager');
  // Le service litige ne peut pas émettre ; il peut refuser (avec un motif)
  assert.equal(
    run(r, { action: 'credit-issue', creditId: 'c0', number: 'AV-4' }, litige, WITH_THRESHOLD)
      .status,
    403,
  );
  assert.equal(
    run(
      r,
      { action: 'credit-decision', creditId: 'c0', decision: 'refuse' },
      litige,
      WITH_THRESHOLD,
    ).status,
    400,
  );
  // Un admin émet directement
  assert.equal(
    run(r, { action: 'credit-issue', creditId: 'c0', number: 'AV-4' }, chef, WITH_THRESHOLD)
      .message,
    'Avoir enregistré',
  );

  // Montant augmenté par le service litige au-delà du seuil : émission refusée, transmission
  const r2 = { amount: 900 };
  run(r2, { action: 'credit-request', request: { ...big, amount: 100 } }, litige, WITH_THRESHOLD);
  assert.equal(r2.credits[0].status, 'requested');
  assert.match(
    run(
      r2,
      { action: 'credit-issue', creditId: 'c0', number: 'AV-5', amount: 300 },
      litige,
      WITH_THRESHOLD,
    ).error,
    /admin doit valider/,
  );
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
  run(r, { action: 'credit-request', request: request() }, litige);
  run(r, { action: 'credit-request', request: request({ amount: 10 }) }, litige);
  assert.equal(openCredits(r).length, 2);
  assert.equal(
    run(
      r,
      { action: 'credit-decision', creditId: 'c0', decision: 'refuse', comment: 'Hors garantie' },
      litige,
    ).message,
    'Demande refusée',
  );
  // Un collègue du service litige peut annuler une demande qu'il n'a pas faite
  const collegue = { ...litige, email: 'autre@x.fr', name: 'Autre' };
  assert.equal(
    run(r, { action: 'credit-cancel', creditId: 'c1' }, collegue).message,
    'Demande annulée',
  );
  assert.equal(openCredits(r).length, 0);
  assert.deepEqual(creditPermissions(r.credits[0], chef), NOTHING);
});

test('Demandes invalides refusées', () => {
  const r = { amount: 100 };
  assert.match(
    run(r, { action: 'credit-request', request: request({ amount: 0 }) }, litige).error,
    /supérieur à zéro/,
  );
  assert.match(
    run(r, { action: 'credit-request', request: request({ reason: 'Inventé' }) }, litige).error,
    /motif/,
  );
  assert.match(
    run(r, { action: 'credit-request', request: request({ amount: 1000 }) }, litige).error,
    /dépasse/,
  );
  assert.match(
    run(r, { action: 'credit-request', request: request({ imputation: 'X' }) }, litige).error,
    /imputation/,
  );
});

test('Réglages des admins (plus de destinataire de mail)', () => {
  assert.deepEqual(
    normalizeCreditSettings(DEFAULT_CREDIT_SETTINGS).settings,
    DEFAULT_CREDIT_SETTINGS,
  );
  // Ancien réglage « notify » (mail à P. Mazeaud) ignoré
  assert.equal(
    normalizeCreditSettings({ ...DEFAULT_CREDIT_SETTINGS, notify: { name: 'X', email: 'x' } })
      .settings.notify,
    undefined,
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
