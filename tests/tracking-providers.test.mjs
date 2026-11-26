import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_FIELDS,
  apiStatus,
  cacheFresh,
  demoTracking,
  fallbackProvider,
  fetchTracking,
  mergeSecrets,
  normalizeApiKeys,
  parseFedex,
  parseLaPoste,
  providerFor,
  testConnection,
  trackingProvider,
} from '../app/tracking-providers.mjs';

const laposte = {
  lang: 'fr_FR',
  returnCode: 200,
  shipment: {
    idShip: 'XN523983495FR',
    product: 'chronopost',
    isFinal: true,
    deliveryDate: '2026-11-08T10:20:00+01:00',
    timeline: [1, 2, 3, 4, 5].map((id) => ({ id, status: true, shortLabel: 'Étape ' + id })),
    event: [
      { code: 'PC1', label: 'Pris en charge', date: '2026-11-06T18:00:00+01:00' },
      { code: 'DI1', label: 'Votre colis est livré.', date: '2026-11-08T10:20:00+01:00' },
    ],
  },
};

test('Welcometrack d’abord pour tous les transporteurs', () => {
  for (const c of ['CHRONOPOST', 'COLISSIMO', 'FEDEX', 'TNT', 'GEODIS', ''])
    assert.equal(trackingProvider(c, {}), 'welcometrack');
  assert.equal(providerFor('TNT'), 'welcometrack');
  assert.deepEqual(Object.keys(API_FIELDS), ['welcometrack', 'laposte', 'fedex']);
});

test('Secours : La Poste pour Colissimo / Chronopost, FedEx pour FedEx / TNT, si la clé est réglée', () => {
  const lp = { LAPOSTE_OKAPI_KEY: 'k' };
  const fx = { FEDEX_CLIENT_ID: 'a', FEDEX_CLIENT_SECRET: 'b' };
  assert.equal(fallbackProvider('CHRONOPOST', lp), 'laposte');
  assert.equal(fallbackProvider('colissimo', lp), 'laposte');
  assert.equal(fallbackProvider('CHRONOPOST', {}), '');
  assert.equal(fallbackProvider('TNT', fx), 'fedex');
  assert.equal(fallbackProvider('FEDEX', fx), 'fedex');
  assert.equal(fallbackProvider('TNT', lp), '');
  assert.equal(fallbackProvider('GEODIS', { ...lp, ...fx }), '');
});

test('réponse La Poste : étapes, événements récents d’abord, livraison', () => {
  const r = parseLaPoste(laposte);
  assert.equal(r.status, 'ok');
  assert.equal(r.step, 5);
  assert.equal(r.delivered, true);
  assert.equal(r.events[0].label, 'Votre colis est livré.');
  assert.equal(r.via, 'laposte');
  assert.equal(parseLaPoste({ returnCode: 404, returnMessage: 'Inconnu' }).status, 'not-found');
});

test('réponse FedEx', () => {
  const r = parseFedex({
    output: {
      completeTrackResults: [
        {
          trackResults: [
            {
              latestStatusDetail: { code: 'IT', description: 'In transit' },
              scanEvents: [
                {
                  date: '2026-11-05T08:00:00Z',
                  eventDescription: 'In transit',
                  scanLocation: { city: 'ROISSY', countryCode: 'FR' },
                },
              ],
            },
          ],
        },
      ],
    },
  });
  assert.equal(r.status, 'ok');
  assert.equal(r.step, 3);
  assert.equal(r.events[0].place, 'ROISSY, FR');
  assert.equal(r.via, 'fedex');
});

test('appels : Welcometrack et La Poste en lecture, sans clé pas d’appel', async () => {
  let called = null;
  const fetcher = async (url, init) => {
    called = { url, key: init.headers.xapikey || init.headers['X-Okapi-Key'] };
    return {
      status: 200,
      json: async () => (String(url).includes('laposte') ? laposte : { traces: [] }),
    };
  };
  const ctx = { carrier: 'COLISSIMO', wtCarriers: [{ id: 1, name: 'Colissimo' }] };
  assert.equal(
    (await fetchTracking('welcometrack', 'XN1', {}, fetcher, ctx)).status,
    'not-configured',
  );
  assert.equal(called, null);
  assert.equal(
    (await fetchTracking('welcometrack', 'XN1', { WELCOMETRACK_API_KEY: 'k' }, fetcher, ctx))
      .status,
    'ok',
  );
  const r = await fetchTracking('laposte', 'XN523983495FR', { LAPOSTE_OKAPI_KEY: 'lp' }, fetcher);
  assert.equal(r.status, 'ok');
  assert.match(called.url, /suivi\/v2\/idships\/XN523983495FR/);
  assert.equal(called.key, 'lp');
  assert.equal((await fetchTracking('autre', 'X', {})).status, 'unsupported');
});

test('cache : 30 minutes, 7 jours une fois livré, 6 heures si inconnu', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const at = (min) => new Date(now - min * 60e3).toISOString();
  assert.ok(cacheFresh({ fetchedAt: at(10), result: { final: false } }, now));
  assert.ok(!cacheFresh({ fetchedAt: at(40), result: { final: false } }, now));
  assert.ok(cacheFresh({ fetchedAt: at(60 * 24 * 3), result: { final: true } }, now));
  assert.ok(cacheFresh({ fetchedAt: at(300), result: { status: 'not-found' } }, now));
  assert.ok(!cacheFresh({ fetchedAt: at(420), result: { status: 'not-found' } }, now));
  assert.ok(!cacheFresh(null, now));
});

test('suivi simulé de la démonstration', () => {
  const r = demoTracking('XN385212984FR', '2026-11-10T10:00:00Z');
  assert.equal(r.status, 'ok');
  assert.ok(r.events.length >= 4);
  assert.ok(r.demo);
});

test('connexions : valeurs contrôlées, outil avant serveur, jamais la clé', async () => {
  assert.match(normalizeApiKeys('welcometrack', {}).error, /Clé API/);
  assert.match(normalizeApiKeys('laposte', { LAPOSTE_OKAPI_KEY: 'a b' }).error, /invalide/);
  assert.match(normalizeApiKeys('ups', {}).error, /inconnue/);
  const env = { WELCOMETRACK_API_KEY: 'serveur', FEDEX_CLIENT_ID: 'id-serveur' };
  const stored = {
    welcometrack: {
      values: { WELCOMETRACK_API_KEY: 'outil-abcd' },
      savedAt: '2026-11-26',
      savedBy: 'Lydia',
    },
  };
  const secrets = mergeSecrets(env, stored);
  assert.equal(secrets.WELCOMETRACK_API_KEY, 'outil-abcd');
  assert.equal(secrets.FEDEX_CLIENT_ID, 'id-serveur');
  const status = apiStatus(env, stored);
  assert.equal(status.welcometrack.source, 'outil');
  assert.equal(status.welcometrack.hint, '…abcd');
  assert.ok(!JSON.stringify(status).includes('outil-abcd'));
  assert.equal(status.fedex.configured, false); // secret FedEx incomplet sur le serveur
  const answer = (code) => async () => ({ status: code, json: async () => ({}) });
  assert.equal((await testConnection('welcometrack', secrets, answer(401))).ok, false);
  assert.equal((await testConnection('welcometrack', secrets, answer(200))).ok, true);
  assert.equal((await testConnection('laposte', { LAPOSTE_OKAPI_KEY: 'x' }, answer(404))).ok, true);
  const token = async () => ({ status: 200, json: async () => ({ access_token: 't' }) });
  assert.equal(
    (await testConnection('fedex', { FEDEX_CLIENT_ID: 'a', FEDEX_CLIENT_SECRET: 'b' }, token)).ok,
    true,
  );
});
