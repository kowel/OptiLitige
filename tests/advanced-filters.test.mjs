import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countAdvanced,
  hasCredit,
  matchesAdvanced,
  normalizeViews,
  sourceOf,
} from '../app/advanced-filters.mjs';

const members = [
  { email: 'rc@x.fr', role: 'RC' },
  { email: 'sav@x.fr', role: 'SAV' },
];
const records = [
  {
    id: 'a',
    brand: 'GROSBILL',
    carrier: 'DPD',
    type: 'Inversion',
    creator: 'rc@x.fr',
    amount: 800,
  },
  {
    id: 'b',
    brand: 'CYBERTEK',
    carrier: 'DPD',
    type: 'Montage',
    creator: 'sav@x.fr',
    amount: 120,
    creditIssued: true,
  },
  {
    id: 'import-c',
    brand: 'CYBERTEK',
    carrier: 'TNT',
    type: 'Inversion',
    creator: 'chef@x.fr',
    amount: 500,
  },
  {
    id: 'd',
    brand: 'GROSBILL',
    creator: 'rc@x.fr',
    amount: 60,
    credits: [{ status: 'requested' }],
  },
  { id: 'e', brand: 'GROSBILL', creator: 'rc@x.fr', amount: 60, credits: [{ status: 'refused' }] },
];
const ids = (adv) => records.filter((r) => matchesAdvanced(r, adv, members)).map((r) => r.id);

test('Filtres par enseigne, transporteur, type et service créateur', () => {
  assert.deepEqual(ids({ brand: 'GROSBILL' }), ['a', 'd', 'e']);
  assert.deepEqual(ids({ carrier: 'DPD' }), ['a', 'b']);
  assert.deepEqual(ids({ type: 'Inversion', carrier: 'TNT' }), ['import-c']);
  assert.deepEqual(ids({ source: 'SAV' }), ['b']);
  assert.deepEqual(ids({ source: 'import' }), ['import-c']);
  assert.equal(sourceOf(records[0], members), 'RC');
});

test('Montant minimum / maximum et avoirs', () => {
  assert.deepEqual(ids({ min: '500' }), ['a', 'import-c']);
  assert.deepEqual(ids({ min: '100', max: '500' }), ['b', 'import-c']);
  assert.deepEqual(ids({ credit: 'with' }), ['b', 'd']); // demande refusée = sans avoir
  assert.deepEqual(ids({ credit: 'without' }), ['a', 'import-c', 'e']);
  assert.equal(hasCredit({ creditNumber: 'AV-1' }), true);
  assert.deepEqual(
    ids({}),
    records.map((r) => r.id),
  );
  assert.equal(countAdvanced({ brand: 'X', min: '10' }), 2);
  assert.equal(countAdvanced({}), 0);
});

test('Vues enregistrées : validation', () => {
  const ok = normalizeViews([
    {
      id: 'v1',
      name: ' DPD > 500 € ',
      filters: {
        q: '',
        status: 'Tous',
        period: '99999',
        adv: { carrier: 'DPD', min: '500', autre: 'x' },
      },
    },
  ]);
  assert.equal(ok.views[0].name, 'DPD > 500 €');
  assert.equal(ok.views[0].filters.adv.carrier, 'DPD');
  assert.equal(ok.views[0].filters.adv.autre, undefined);
  assert.match(normalizeViews([{ name: '' }]).error, /nom/);
  assert.match(normalizeViews(new Array(21).fill({ name: 'x' })).error, /20 vues/);
  assert.match(normalizeViews('pas une liste').error, /20 vues/);
});

test('Vues partagées par service : ajout, nom unique, suppression', async () => {
  const { applyViewAction, viewsKey } = await import('../app/advanced-filters.mjs');
  const rc = { email: 'rc@x.fr', name: 'Claire', role: 'RC' };
  const now = '2026-11-09T10:00:00Z';
  const view = { name: 'Mes DPD', filters: { adv: { carrier: 'DPD' } } };
  const added = applyViewAction([], { action: 'view-add', view }, rc, now, 'v1');
  assert.equal(added.views[0].id, 'v1');
  assert.equal(added.views[0].createdByName, 'Claire');
  assert.match(
    applyViewAction(
      added.views,
      { action: 'view-add', view: { ...view, name: 'mes dpd' } },
      rc,
      now,
      'v2',
    ).error,
    /déjà ce nom/,
  );
  assert.equal(
    applyViewAction(added.views, { action: 'view-delete', id: 'v1' }, rc).views.length,
    0,
  );
  assert.match(
    applyViewAction(added.views, { action: 'view-delete', id: 'x' }, rc).error,
    /introuvable/,
  );
  const full = new Array(20).fill(0).map((_, i) => ({ id: 'v' + i, name: 'V' + i }));
  assert.match(applyViewAction(full, { action: 'view-add', view }, rc, now, 'n').error, /20 vues/);
  assert.equal(viewsKey('Service Litige'), 'views-role:Service Litige');
});

test('filtre par type de produit et dossiers de 2 000 € ou plus', async () => {
  const { isHighAmount, HIGH_AMOUNT } = await import('../app/advanced-filters.mjs');
  const pc = { productType: 'PC', amount: 1999.99 };
  const portable = { productType: 'PC Portable', amount: 2000 };
  assert.equal(matchesAdvanced(pc, { productType: 'PC' }), true);
  assert.equal(matchesAdvanced(portable, { productType: 'PC' }), false);
  assert.equal(HIGH_AMOUNT, 2000);
  assert.equal(isHighAmount(pc), false);
  assert.equal(isHighAmount(portable), true);
});

test('repères de montant : orange, rouge, seuils réglables', async () => {
  const { amountMark, normalizeAmountAlerts, DEFAULT_AMOUNT_ALERTS } =
    await import('../app/advanced-filters.mjs');
  assert.deepEqual(DEFAULT_AMOUNT_ALERTS, { orange: 2000, red: 7500 });
  assert.equal(amountMark({ amount: 1999 }).className, undefined);
  assert.equal(amountMark({ amount: 2000 }).className, 'high-amount');
  assert.equal(amountMark({ amount: 7500 }).className, 'very-high-amount');
  assert.match(amountMark({ amount: 8000 }).title, /7\s500\s€ ou plus/);
  const custom = { orange: 1000, red: 0 }; // rouge désactivé
  assert.equal(amountMark({ amount: 9000 }, custom).className, 'high-amount');
  assert.equal(amountMark({ amount: 5000 }, { orange: 0, red: 0 }).className, undefined);
  assert.deepEqual(normalizeAmountAlerts({ orange: '1500', red: '' }).alerts, {
    orange: 1500,
    red: 0,
  });
  assert.ok(normalizeAmountAlerts({ orange: 5000, red: 3000 }).error);
  assert.ok(normalizeAmountAlerts({ orange: -1, red: 3000 }).error);
});
