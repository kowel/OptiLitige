import test from 'node:test';
import assert from 'node:assert/strict';
import {
  darkVariant,
  normalizeBrandColors,
  normalizeListUpdate,
  renameText,
} from '../app/list-settings.mjs';

test('liste : ajout, suppression, ordre, doublons', () => {
  const prev = ['CYBERTEK', 'GROSBILL', 'MAGASIN'];
  const ok = normalizeListUpdate(
    'brands',
    ['GROSBILL', ' NOUVELLE ', 'CYBERTEK', 'MAGASIN', ''],
    [],
    prev,
  );
  assert.deepEqual(ok.values, ['GROSBILL', 'NOUVELLE', 'CYBERTEK', 'MAGASIN']);
  assert.match(normalizeListUpdate('brands', ['A', 'a', 'MAGASIN'], [], prev).error, /deux fois/);
  assert.match(normalizeListUpdate('brands', [], [], prev).error, /au moins une/);
  assert.match(normalizeListUpdate('inconnue', ['A'], []).error, /inconnue/);
});

test('valeurs verrouillées : ni supprimées ni renommées', () => {
  const stages = [
    'À transmettre',
    'Envoyé au transporteur',
    'En attente réponse',
    'Réponse reçue',
    'Indemnisation attendue',
    'Clos',
  ];
  assert.match(
    normalizeListUpdate('carrierStages', stages.slice(1), [], stages).error,
    /utilisé par l’outil/,
  );
  assert.deepEqual(
    normalizeListUpdate('carrierStages', [...stages, 'Litige au tribunal'], [], stages).values.at(
      -1,
    ),
    'Litige au tribunal',
  );
  assert.match(
    normalizeListUpdate(
      'brands',
      ['CYBERTEK', 'BOUTIQUE'],
      [{ from: 'MAGASIN', to: 'BOUTIQUE' }],
      ['CYBERTEK', 'MAGASIN'],
    ).error,
    /utilisé par l’outil|ne peut pas être renommé/,
  );
});

test('renommage : gardé seulement s’il mène à une valeur de la liste', () => {
  const r = normalizeListUpdate(
    'carriers',
    ['COLISSIMO', 'DPD'],
    [{ from: 'GLS', to: 'DPD' }],
    ['COLISSIMO', 'GLS'],
  );
  assert.deepEqual(r.renames, [{ from: 'GLS', to: 'DPD' }]);
  assert.match(
    normalizeListUpdate(
      'carriers',
      ['COLISSIMO'],
      [{ from: 'GLS', to: 'DPD' }],
      ['COLISSIMO', 'GLS'],
    ).error,
    /absent/,
  );
  assert.equal(
    renameText('carriers', 'GLS', 'DPD'),
    'Paramètres : transporteurs renommé « GLS » → « DPD »',
  );
});

test('couleurs des enseignes et version pour le mode sombre', () => {
  assert.deepEqual(normalizeBrandColors({ A: '#ABCDEF', B: 'rouge', C: '#123456' }, ['A', 'B']), {
    A: '#abcdef',
  });
  const light = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) + ((n >> 8) & 255) + (n & 255)) / 3;
  };
  assert.ok(light(darkVariant('#111318')) > 220); // noir → presque blanc
  assert.ok(light(darkVariant('#d1202b')) > light('#d1202b')); // rouge éclairci
});
