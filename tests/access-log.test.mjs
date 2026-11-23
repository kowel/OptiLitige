import test from 'node:test';
import assert from 'node:assert/strict';
import { demoAccessEntry, describeAccessChange } from '../app/access-log.mjs';

test('Journal des accès : textes lisibles', () => {
  const a = { name: 'Léa', role: 'RC' };
  assert.equal(describeAccessChange({ before: null, after: a }), 'Accès accordé : RC');
  assert.equal(
    describeAccessChange({ before: a, after: { ...a, role: 'Service Litige' } }),
    'Service : RC → Service Litige',
  );
  assert.equal(
    describeAccessChange({ before: a, after: { ...a, role: 'Désactivé' } }),
    'Compte désactivé (était RC)',
  );
  assert.equal(
    describeAccessChange({ before: { ...a, role: 'Désactivé' }, after: a }),
    'Compte réactivé : RC',
  );
  assert.equal(
    describeAccessChange({ before: a, after: { name: 'Léa B.', role: 'RC' } }),
    'Nom : Léa → Léa B.',
  );
  assert.equal(describeAccessChange({ note: 'Premier compte' }), 'Premier compte');
});

test('Journal des accès : ligne du mode démonstration', () => {
  const e = demoAccessEntry({ email: 'chef@x.fr', name: 'Chef' }, null, {
    email: 'a@x.fr',
    name: 'A',
    role: 'RC',
  });
  assert.equal(e.by, 'chef@x.fr');
  assert.equal(e.before, null);
  assert.deepEqual(e.after, { name: 'A', role: 'RC' });
  assert.ok(Date.parse(e.date));
});
