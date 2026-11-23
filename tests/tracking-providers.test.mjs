import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cacheFresh,
  demoTracking,
  fetchTracking,
  parseFedex,
  parseLaPoste,
  providerFor,
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

test('transporteurs reliés à une API', () => {
  assert.equal(providerFor('CHRONOPOST'), 'laposte');
  assert.equal(providerFor('COLISSIMO'), 'laposte');
  assert.equal(providerFor('FEDEX'), 'fedex');
  assert.equal(providerFor('TNT'), '');
});

test('réponse La Poste : étapes, événements récents d’abord, livraison', () => {
  const r = parseLaPoste(laposte);
  assert.equal(r.status, 'ok');
  assert.equal(r.step, 5);
  assert.equal(r.delivered, true);
  assert.equal(r.events[0].label, 'Votre colis est livré.');
  assert.equal(r.label, 'Votre colis est livré.');
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
                  date: '2026-11-04T08:00:00Z',
                  eventDescription: 'Picked up',
                  scanLocation: { city: 'PARIS', countryCode: 'FR' },
                },
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
  assert.equal(r.delivered, false);
  assert.equal(r.events[0].place, 'ROISSY, FR');
});

test('appel La Poste : clé envoyée, sans clé pas d’appel', async () => {
  let called = null;
  const fetcher = async (url, init) => {
    called = { url, key: init.headers['X-Okapi-Key'] };
    return { status: 200, json: async () => laposte };
  };
  assert.equal((await fetchTracking('laposte', 'XN1', {}, fetcher)).status, 'not-configured');
  assert.equal(called, null);
  const r = await fetchTracking('laposte', 'XN523983495FR', { LAPOSTE_OKAPI_KEY: 'k' }, fetcher);
  assert.equal(r.status, 'ok');
  assert.match(called.url, /suivi\/v2\/idships\/XN523983495FR/);
  assert.equal(called.key, 'k');
  const refused = await fetchTracking('laposte', 'X', { LAPOSTE_OKAPI_KEY: 'k' }, async () => ({
    status: 401,
    json: async () => ({}),
  }));
  assert.equal(refused.status, 'error');
  assert.equal((await fetchTracking('', 'X', {})).status, 'unsupported');
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

test('connexions transporteurs : valeurs contrôlées, outil avant serveur, jamais la clé', async () => {
  const { normalizeApiKeys, mergeSecrets, apiStatus, testConnection } =
    await import('../app/tracking-providers.mjs');
  assert.match(normalizeApiKeys('laposte', {}).error, /Clé Okapi/);
  assert.match(normalizeApiKeys('laposte', { LAPOSTE_OKAPI_KEY: 'a b' }).error, /invalide/);
  assert.match(normalizeApiKeys('ups', {}).error, /inconnu/);
  assert.deepEqual(normalizeApiKeys('laposte', { LAPOSTE_OKAPI_KEY: ' cle-1234 ' }).values, {
    LAPOSTE_OKAPI_KEY: 'cle-1234',
  });
  const env = { LAPOSTE_OKAPI_KEY: 'serveur', FEDEX_CLIENT_ID: 'id-serveur' };
  const stored = {
    laposte: {
      values: { LAPOSTE_OKAPI_KEY: 'outil-abcd' },
      savedAt: '2026-11-16',
      savedBy: 'Lydia',
    },
  };
  const secrets = mergeSecrets(env, stored);
  assert.equal(secrets.LAPOSTE_OKAPI_KEY, 'outil-abcd');
  assert.equal(secrets.FEDEX_CLIENT_ID, 'id-serveur');
  const status = apiStatus(env, stored);
  assert.equal(status.laposte.source, 'outil');
  assert.equal(status.laposte.hint, '…abcd');
  assert.ok(!JSON.stringify(status).includes('outil-abcd'));
  assert.equal(status.fedex.configured, false); // secret FedEx incomplet sur le serveur
  assert.equal(apiStatus({ LAPOSTE_OKAPI_KEY: 'x' }, {}).laposte.source, 'serveur');
  // Test de connexion : 401 = clé refusée, 404 (numéro fictif inconnu) = clé acceptée
  const answer = (status) => async () => ({ status, json: async () => ({}) });
  assert.equal((await testConnection('laposte', secrets, answer(401))).ok, false);
  assert.equal((await testConnection('laposte', secrets, answer(404))).ok, true);
  assert.equal((await testConnection('fedex', secrets)).message, 'Connexion non configurée.');
  const fedex = { FEDEX_CLIENT_ID: 'a', FEDEX_CLIENT_SECRET: 'b' };
  const token = async () => ({ status: 200, json: async () => ({ access_token: 't' }) });
  assert.equal((await testConnection('fedex', fedex, token)).ok, true);
});
