import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStep, treatmentSteps } from '../app/treatment-steps.mjs';

const state = (r) => Object.fromEntries(treatmentSteps(r).map((s) => [s.id, s.state]));

test('nouveau dossier transport : prise en charge par le Service Litige', () => {
  const r = { status: 'Nouveau', origin: 'Transport' };
  assert.equal(state(r).take, 'current');
  assert.deepEqual(nextStep(r, 'Service Litige').mine, true);
  assert.deepEqual(nextStep(r, 'RC').mine, false);
  assert.equal(nextStep(r, 'Admin').mine, true);
});

test('pris en charge, réclamation envoyée, en attente de réponse', () => {
  const r = { status: 'Pris en charge', origin: 'Transport', carrierSentAt: '2026-11-05' };
  assert.deepEqual(state(r), {
    take: 'done',
    carrier: 'done',
    reply: 'current',
    client: 'todo',
    close: 'todo',
  });
});

test('litige interne : étapes transporteur sans objet', () => {
  const s = state({ status: 'Pris en charge', origin: 'Interne' });
  assert.equal(s.carrier, 'skip');
  assert.equal(s.reply, 'skip');
  assert.equal(s.client, 'current');
});

test('en attente RC : c’est à la Relation client', () => {
  const r = { status: 'En attente RC', origin: 'Transport' };
  const { step, mine } = nextStep(r, 'RC');
  assert.equal(step.id, 'rc');
  assert.ok(mine);
  assert.equal(treatmentSteps(r).filter((x) => x.state === 'current').length, 1);
});

test('résolu : plus d’étape en cours', () => {
  assert.equal(
    nextStep({ status: 'Résolu', origin: 'Transport', carrierSentAt: 'x' }, 'Service Litige').step,
    null,
  );
});

test('« Ne concerne pas le transporteur » : étapes transporteur sans objet, pas d’écart', async () => {
  const { indemnityGap, carrierSide, NOT_CARRIER } = await import('../app/carrier-tracking.mjs');
  const r = {
    origin: 'Transport',
    carrierDecision: NOT_CARRIER,
    disputeValue: 120,
    compensation: 0,
  };
  const steps = treatmentSteps(r);
  assert.equal(steps.find((s) => s.id === 'carrier').state, 'skip');
  assert.equal(steps.find((s) => s.id === 'reply').state, 'skip');
  assert.equal(indemnityGap(r), null);
  assert.equal(carrierSide(r), 'Sans objet');
});

test('solution client : « Avoir - nouvelle commande client » vaut solution apportée', () => {
  const step = (clientStage) =>
    treatmentSteps({ status: 'Pris en charge', origin: 'Interne', clientStage }).find(
      (s) => s.id === 'client',
    );
  assert.equal(step('Avoir - nouvelle commande client').done, true);
  assert.equal(step('Remboursement').done, true);
  assert.equal(step('À contacter').done, false);
});
