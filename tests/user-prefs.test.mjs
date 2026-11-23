import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrefs } from '../app/user-prefs.mjs';

test('préférences d’affichage : formats et disposition contrôlés', () => {
  const ok = normalizePrefs({
    charts: { brands: 'pie', activity: 'columns' },
    layouts: { 'analyses:Admin': ['brands', 'activity'] },
  });
  assert.deepEqual(ok.prefs.charts, { brands: 'pie', activity: 'columns' });
  assert.deepEqual(ok.prefs.layouts['analyses:Admin'], ['brands', 'activity']);
  assert.ok(normalizePrefs({ charts: { brands: '3d' } }).error);
  assert.ok(normalizePrefs({ layouts: { 'a b': ['x'] } }).error);
  assert.deepEqual(normalizePrefs({}).prefs, { charts: {}, layouts: {} });
});
