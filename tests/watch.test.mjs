import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWatchAlerts, latestActivity, toggleWatch, watchedIds } from '../app/watch.mjs';
import { ALERT_KEY_PATTERN, buildAlerts } from '../app/alerts.mjs';

const me = { email: 'moi@cybertek.fr', name: 'Moi', role: 'RC' };
const record = (extra) => ({
  id: 'd1',
  ref: 'LIT-1',
  status: 'Pris en charge',
  history: [{ date: '2026-11-10T09:00:00Z', text: 'Dossier créé', author: 'Moi' }],
  comments: [],
  ...extra,
});

test('abonnement et désabonnement', () => {
  const { list } = toggleWatch([], 'd1', true, '2026-11-12T08:00:00Z');
  assert.deepEqual(list, [{ id: 'd1', since: '2026-11-12T08:00:00Z' }]);
  assert.deepEqual(watchedIds(list), ['d1']);
  assert.deepEqual(toggleWatch(list, 'd1', false).list, []);
  // Se réabonner remplace l'entrée (pas de doublon)
  assert.equal(toggleWatch(list, 'd1', true).list.length, 1);
  assert.ok(toggleWatch(list, '', true).error);
});

test('dernière activité : message ou modification, la plus récente', () => {
  const r = record({
    comments: [
      {
        id: 'c',
        text: 'Bonjour',
        author: 'Lydia',
        email: 'lydia@cybertek.fr',
        date: '2026-11-12T10:00:00Z',
      },
    ],
    history: [{ date: '2026-11-12T11:00:00Z', text: 'Pris en charge → Résolu', author: 'Lydia' }],
  });
  assert.equal(latestActivity(r).kind, 'change');
  // Liste allégée : activité calculée par la base
  const lite = {
    id: 'd1',
    activity: {
      history: null,
      comment: { date: '2026-11-12T12:00:00Z', author: 'Lydia', email: 'l@c.fr', text: 'Hello' },
    },
  };
  assert.equal(latestActivity(lite).kind, 'comment');
});

test('notification seulement pour les nouveautés des autres, après l’abonnement', () => {
  const watching = [{ id: 'd1', since: '2026-11-12T08:00:00Z' }];
  const other = record({
    comments: [
      {
        id: 'c',
        text: 'Le transporteur a répondu',
        author: 'Lydia',
        email: 'lydia@cybertek.fr',
        date: '2026-11-12T10:00:00Z',
      },
    ],
  });
  const [a] = buildWatchAlerts([other], me, watching);
  assert.equal(a.title, 'Nouveau message : LIT-1');
  assert.match(a.text, /^Lydia · Le transporteur/);
  assert.ok(a.unread);
  assert.ok(ALERT_KEY_PATTERN.test(a.key));
  // Lue : plus en non lu
  assert.ok(!buildWatchAlerts([other], me, watching, new Set([a.key]))[0].unread);
  // Mon propre message : rien
  const mine = record({
    comments: [
      { id: 'c', text: 'x', author: 'Moi', email: 'moi@cybertek.fr', date: '2026-11-12T10:00:00Z' },
    ],
  });
  assert.equal(buildWatchAlerts([mine], me, watching).length, 0);
  // Activité antérieure à l'abonnement : rien
  assert.equal(
    buildWatchAlerts([other], me, [{ id: 'd1', since: '2026-11-12T11:00:00Z' }]).length,
    0,
  );
  // Dossier non suivi : rien
  assert.equal(buildWatchAlerts([other], me, []).length, 0);
  // Intégré à la cloche, catégorie « Abonnements »
  assert.equal(buildAlerts([other], me, { watching }).watch.length, 1);
});
