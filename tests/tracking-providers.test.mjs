import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_FIELDS,
  apiStatus,
  cacheFresh,
  demoTracking,
  fetchTracking,
  mergeSecrets,
  normalizeApiKeys,
  providerFor,
  testConnection,
  trackingProvider,
} from '../app/tracking-providers.mjs';

test('Tous les transporteurs passent par Welcometrack', () => {
  for (const c of ['CHRONOPOST', 'COLISSIMO', 'FEDEX', 'TNT', 'GEODIS', ''])
    assert.equal(trackingProvider(c, {}), 'welcometrack');
  assert.equal(providerFor('TNT'), 'welcometrack');
  assert.deepEqual(Object.keys(API_FIELDS), ['welcometrack']);
});

test('appel Welcometrack : clé envoyée, sans clé pas d’appel', async () => {
  let called = null;
  const fetcher = async (url, init) => {
    called = { url, key: init.headers.xapikey, method: init.method };
    return { status: 200, json: async () => ({ traces: [] }) };
  };
  const ctx = { carrier: 'COLISSIMO', wtCarriers: [{ id: 1, name: 'Colissimo' }] };
  assert.equal(
    (await fetchTracking('welcometrack', 'XN1', {}, fetcher, ctx)).status,
    'not-configured',
  );
  assert.equal(called, null);
  const r = await fetchTracking('welcometrack', 'XN1', { WELCOMETRACK_API_KEY: 'k' }, fetcher, ctx);
  assert.equal(r.status, 'ok');
  assert.equal(called.key, 'k');
  assert.equal(called.method, 'GET');
  assert.equal((await fetchTracking('laposte', 'X', {})).status, 'unsupported');
});

test('cache : 30 minutes, 7 jours une fois livré', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const at = (min) => new Date(now - min * 60e3).toISOString();
  assert.ok(cacheFresh({ fetchedAt: at(10), result: { final: false } }, now));
  assert.ok(!cacheFresh({ fetchedAt: at(40), result: { final: false } }, now));
  assert.ok(cacheFresh({ fetchedAt: at(60 * 24 * 3), result: { final: true } }, now));
  assert.ok(!cacheFresh(null, now));
});

test('suivi simulé de la démonstration', () => {
  const r = demoTracking('XN385212984FR', '2026-11-10T10:00:00Z');
  assert.equal(r.status, 'ok');
  assert.ok(r.events.length >= 4);
  assert.ok(r.demo);
});

test('cache : un numéro inconnu est gardé 6 heures', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const at = (h) => new Date(now - h * 3600e3).toISOString();
  assert.ok(cacheFresh({ fetchedAt: at(5), result: { status: 'not-found' } }, now));
  assert.ok(!cacheFresh({ fetchedAt: at(7), result: { status: 'not-found' } }, now));
});

test('connexion Welcometrack : valeur contrôlée, outil avant serveur, jamais la clé', async () => {
  assert.match(normalizeApiKeys('welcometrack', {}).error, /Clé API/);
  assert.match(normalizeApiKeys('welcometrack', { WELCOMETRACK_API_KEY: 'a b' }).error, /invalide/);
  assert.match(normalizeApiKeys('laposte', {}).error, /inconnue/);
  assert.deepEqual(
    normalizeApiKeys('welcometrack', { WELCOMETRACK_API_KEY: ' cle-1234 ' }).values,
    { WELCOMETRACK_API_KEY: 'cle-1234' },
  );
  const env = { WELCOMETRACK_API_KEY: 'serveur' };
  const stored = {
    welcometrack: {
      values: { WELCOMETRACK_API_KEY: 'outil-abcd' },
      savedAt: '2026-11-26',
      savedBy: 'Lydia',
    },
    // Anciennes clés La Poste / FedEx restées en base : ignorées
    laposte: { values: { LAPOSTE_OKAPI_KEY: 'vieille' } },
  };
  const secrets = mergeSecrets(env, stored);
  assert.deepEqual(secrets, { WELCOMETRACK_API_KEY: 'outil-abcd' });
  const status = apiStatus(env, stored);
  assert.deepEqual(Object.keys(status), ['welcometrack']);
  assert.equal(status.welcometrack.source, 'outil');
  assert.equal(status.welcometrack.hint, '…abcd');
  assert.ok(!JSON.stringify(status).includes('outil-abcd'));
  assert.equal(apiStatus(env, {}).welcometrack.source, 'serveur');
  const answer = (code) => async () => ({ status: code, json: async () => ({}) });
  assert.equal((await testConnection('welcometrack', secrets, answer(401))).ok, false);
  assert.equal((await testConnection('welcometrack', secrets, answer(200))).ok, true);
  assert.equal((await testConnection('welcometrack', {})).message, 'Connexion non configurée.');
});
