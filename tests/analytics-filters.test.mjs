import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_ANALYTICS,
  countAnalytics,
  filterAnalytics,
  matchesAnalytics,
  describeAnalytics,
} from '../app/analytics-filters.mjs';

const rows = [
  {
    id: 'a',
    brand: 'Cybertek',
    carrier: 'DPD',
    type: 'Colis cassé',
    origin: 'Transport',
    creator: 'x@c.fr',
    priority: 'Haute',
    creditIssued: true,
  },
  {
    id: 'b',
    brand: 'MAGASIN',
    store: 'Lyon',
    carrier: 'GLS',
    type: 'Erreur',
    origin: 'Interne',
    creator: '',
    priority: 'Normale',
  },
  { id: 'import-c', brand: 'Grosbill', carrier: 'DPD', productType: 'PC', origin: 'Transport' },
];

test('sans filtre, tous les dossiers restent', () => {
  assert.equal(countAnalytics(EMPTY_ANALYTICS), 0);
  assert.equal(filterAnalytics(rows, EMPTY_ANALYTICS), rows);
});

test('enseigne et transporteur se combinent', () => {
  const ids = (f) => filterAnalytics(rows, { ...EMPTY_ANALYTICS, ...f }).map((r) => r.id);
  assert.deepEqual(ids({ carrier: 'DPD' }), ['a', 'import-c']);
  assert.deepEqual(ids({ carrier: 'DPD', brand: 'Grosbill' }), ['import-c']);
  assert.deepEqual(ids({ brand: 'MAGASIN', store: 'Lyon' }), ['b']);
  assert.deepEqual(ids({ productType: 'PC' }), ['import-c']);
  assert.deepEqual(ids({ origin: 'Interne' }), ['b']);
  assert.equal(countAnalytics({ carrier: 'DPD', brand: 'Grosbill' }), 2);
});

test('agent (créateur), priorité, avoir et service créateur', () => {
  const m = (f, r) => matchesAnalytics(r, { ...EMPTY_ANALYTICS, ...f }, [{ email: 'x@c.fr' }]);
  assert.ok(m({ assignee: 'none' }, rows[1]));
  assert.ok(!m({ assignee: 'none' }, rows[0]));
  assert.ok(m({ assignee: 'x@c.fr' }, rows[0]));
  assert.ok(m({ priority: 'urgent' }, rows[0]));
  assert.ok(m({ priority: 'normal' }, rows[1]));
  assert.ok(m({ credit: 'with' }, rows[0]));
  assert.ok(m({ credit: 'without' }, rows[1]));
  assert.ok(m({ source: 'import' }, rows[2]));
  assert.ok(!m({ source: 'import' }, rows[0]));
});

test('imputation : interne, transporteur ou non précisée', () => {
  const list = [
    { id: 'i', imputation: 'Interne' },
    { id: 't', imputation: 'Transporteur' },
    { id: 'n' },
  ];
  const ids = (f) => filterAnalytics(list, { imputation: f }).map((r) => r.id);
  assert.deepEqual(ids('Interne'), ['i']);
  assert.deepEqual(ids('Transporteur'), ['t']);
  assert.deepEqual(ids('none'), ['n']);
  assert.deepEqual(describeAnalytics({ imputation: 'none' }), ['Imputation : Non précisée']);
});

test('filtres en clair pour le bandeau de la liste', () => {
  assert.deepEqual(describeAnalytics(EMPTY_ANALYTICS), []);
  assert.deepEqual(
    describeAnalytics(
      {
        brand: 'GROSBILL',
        assignee: 'x@c.fr',
        priority: 'urgent',
        source: 'RC',
        credit: 'without',
      },
      [{ email: 'x@c.fr', name: 'Lydia' }],
    ),
    [
      'Enseigne : GROSBILL',
      'Service créateur : Relation client',
      'Agent (créateur) : Lydia',
      'Priorité : Urgents seulement',
      'Avoir : Sans avoir',
    ],
  );
  assert.deepEqual(describeAnalytics({ assignee: 'none' }), [
    'Agent (créateur) : Auteur sans compte',
  ]);
});
