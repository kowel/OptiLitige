import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPrefill } from '../app/prefill.mjs';

const ctx = {
  now: '2026-11-12T10:00:00Z',
  author: 'Seedy',
  carrierStages: [
    'À transmettre',
    'Envoyé au transporteur',
    'En attente réponse',
    'Réponse reçue',
    'Clos',
  ],
  clientStages: ['En attente réponse transporteur', 'Solution à valider'],
};

test('remplit seulement les champs vides et garde la trace', () => {
  const r = {
    carrierCaseRef: '',
    carrierSentAt: null,
    carrierStatus: 'En attente réponse',
    clientStage: 'Non renseignée (import)',
    carrierDecision: 'Accepté',
    history: [],
  };
  const { applied, skipped } = applyPrefill(
    r,
    {
      carrierCaseRef: '78038005',
      carrierSentAt: '2026-10-20',
      carrierStatus: 'Réponse reçue',
      clientStage: 'Solution à valider',
      carrierDecision: 'Refusé',
    },
    { carrierCaseRef: '20/10 : Ticket' },
    ctx,
  );
  assert.deepEqual(
    applied.sort(),
    ['carrierCaseRef', 'carrierSentAt', 'carrierStatus', 'clientStage'].sort(),
  );
  assert.deepEqual(skipped, [{ field: 'carrierDecision', reason: 'déjà rempli' }]);
  assert.equal(r.carrierDecision, 'Accepté');
  assert.equal(r.prefilled.fields.length, 4);
  assert.equal(r.prefilled.sources.carrierCaseRef, '20/10 : Ticket');
  assert.match(r.history[0].text, /Pré-rempli d’après les échanges \(à vérifier\)/);
  assert.equal(r.rev, 1);
});

test('valeurs invalides refusées ; état « Clos » jamais remplacé', () => {
  const r = { carrierStatus: 'Clos' };
  const { applied, skipped } = applyPrefill(
    r,
    {
      carrierStatus: 'Réponse reçue',
      carrierSentAt: '12/10/2026',
      carrierDecision: 'Peut-être',
      clientStage: 'Inconnue',
    },
    {},
    ctx,
  );
  assert.deepEqual(applied, []);
  assert.equal(skipped.length, 4);
  assert.equal(r.prefilled, undefined);
});

test('clôture : résultat de la liste et imputation, sans écraser une valeur saisie', () => {
  const c = { ...ctx, outcomes: ['Colis perdu', 'Livraison conforme'] };
  const r = { history: [], outcome: '', imputation: '' };
  const res = applyPrefill(
    r,
    { outcome: 'Colis perdu', imputation: 'Transporteur' },
    { outcome: '« colis perdu par Chronopost »', imputation: '« indemnisé par le transporteur »' },
    c,
  );
  assert.deepEqual(res.applied, ['outcome', 'imputation']);
  assert.equal(r.outcome, 'Colis perdu');
  assert.equal(r.imputation, 'Transporteur');
  // Valeurs hors liste refusées
  const bad = applyPrefill({ history: [] }, { outcome: 'Inventé', imputation: 'Client' }, {}, c);
  assert.deepEqual(
    bad.skipped.map((s) => s.reason),
    ['résultat hors liste', 'imputation inconnue'],
  );
  // Déjà rempli : on garde la saisie de l'agent
  const kept = { history: [], outcome: 'Livraison conforme', imputation: 'Interne' };
  applyPrefill(kept, { outcome: 'Colis perdu', imputation: 'Transporteur' }, {}, c);
  assert.equal(kept.outcome, 'Livraison conforme');
  assert.equal(kept.imputation, 'Interne');
});
