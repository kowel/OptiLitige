import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countShipments,
  fetchAlertRows,
  fetchWtTracking,
  normalizeAlertId,
  parseWelcometrack,
  WT_NOT_FOUND,
  wtCarrierId,
  wtCarrierIds,
  wtDate,
} from '../app/welcometrack.mjs';
import { fetchTracking, trackingProvider } from '../app/tracking-providers.mjs';

const carriers = [
  { id: 1, name: 'Colissimo' },
  { id: 2, name: 'Chronopost' },
  { id: 7, name: 'TNT' },
  { id: 9, name: 'Kuehne + Nagel' },
];

// Faux serveur Welcometrack : note chaque appel et vérifie qu'il ne fait que LIRE
function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init) => {
    assert.equal(init.method, 'GET');
    assert.ok(init.headers.xapikey);
    const u = new URL(url);
    calls.push(u.pathname + u.search);
    const r = routes(u);
    return { status: r.status ?? 200, json: async () => r.json ?? {} };
  };
  f.calls = calls;
  return f;
}

test('Dates Welcometrack (jj/mm/aaaa + heure) → date lisible', () => {
  assert.equal(wtDate('16/05/2023', '17:34:00'), '2023-05-16T17:34:00');
  assert.equal(wtDate('16/05/2023'), '2023-05-16T00:00:00');
  assert.equal(wtDate('2023-05-16'), '');
});

test('Transporteur du dossier → identifiant Welcometrack', () => {
  assert.equal(wtCarrierId(carriers, 'CHRONOPOST'), 2);
  assert.equal(wtCarrierId(carriers, 'TNT FRANCE'), 7);
  assert.equal(wtCarrierId(carriers, 'KUEHNE NAGEL'), 9);
  assert.equal(wtCarrierId(carriers, 'GEODIS'), 0);
  assert.equal(wtCarrierId(carriers, ''), 0);
});

test('Suivi Welcometrack : événements, étape, livraison, incident', () => {
  const r = parseWelcometrack({
    errorcode: 0,
    provider_name: 'Chronopost',
    delivery_delivered: true,
    delivery_date: '25/05/2023',
    delivery_hour: '16:04:00',
    delivery_damaged: true,
    traces: [
      {
        message: 'Colis en cours d’acheminement',
        date: '16/05/2023',
        hour: '17:34:00',
        location: 'ARRAS',
      },
      { message: 'Livraison effectuée', date: '25/05/2023', hour: '16:04:00', location: '' },
    ],
  });
  assert.equal(r.status, 'ok');
  assert.equal(r.delivered, true);
  assert.equal(r.step, 5);
  assert.equal(r.events[0].label, 'Livraison effectuée');
  assert.equal(r.deliveredAt, '2023-05-25T16:04:00');
  assert.equal(r.issue, 'Avarie signalée');
  assert.equal(r.via, 'welcometrack');
  const moving = parseWelcometrack({
    traces: [{ message: 'Colis en cours de livraison', date: '17/05/2023', hour: '09:00:00' }],
  });
  assert.equal(moving.step, 4);
  assert.equal(moving.delivered, false);
  assert.equal(parseWelcometrack({ ErrorCode: 8, ErrorMsg: 'Aucune réponse' }).status, 'not-found');
});

test('France Express cherché sous Geodis, puis les autres transporteurs ; sinon message de repli', async () => {
  const list = [...carriers, { id: 22, name: 'Geodis' }];
  assert.equal(wtCarrierIds(list, 'FRANCE EXPRESS')[0], 22);
  assert.equal(wtCarrierIds(list, 'TNT')[0], 7);
  assert.ok(wtCarrierIds(list, 'TNT').includes(22));
  const found = fakeFetch((u) =>
    u.searchParams.get('carrierid') === '22'
      ? {
          json: {
            provider_name: 'Geodis',
            traces: [{ message: 'Pris en charge', date: '14/10/2026' }],
          },
        }
      : { status: 404, json: { ErrorCode: 8 } },
  );
  const r = await fetchWtTracking(
    { number: '1G3QUV94MPFH', carrier: 'FRANCE EXPRESS', key: 'k', wtCarriers: list },
    found,
  );
  assert.equal(r.status, 'ok');
  assert.equal(found.calls.length, 1);
  const none = await fetchWtTracking(
    { number: 'X1', carrier: 'TNT', order: '123', key: 'k', wtCarriers: list },
    fakeFetch(() => ({ status: 404, json: { ErrorCode: 8 } })),
  );
  assert.equal(none.status, 'not-found');
  assert.equal(none.message, WT_NOT_FOUND);
});

test('Suivi par n° de suivi, sinon par n° de commande', async () => {
  const f = fakeFetch((u) =>
    u.pathname.endsWith('/deliveries/get')
      ? u.searchParams.get('delivery_reference') === 'XA1'
        ? { json: { errorcode: 0, traces: [{ message: 'Pris en charge', date: '01/11/2026' }] } }
        : { status: 404, json: { ErrorCode: 8 } }
      : {
          json: {
            packages: [
              { package_reference: 'A', deliveries: { delivery_trackingurl: 'https://x/ZZ1' } },
              {
                package_reference: 'B',
                deliveries: { delivery_trackingurl: 'https://x/XY99', delivery_delivered: true },
                tracking: [{ message: 'Livré', date: '03/11/2026' }],
              },
            ],
          },
        },
  );
  const byNumber = await fetchWtTracking(
    { number: 'XA1', carrier: 'TNT FRANCE', order: '', key: 'k', wtCarriers: carriers },
    f,
  );
  assert.equal(byNumber.status, 'ok');
  assert.match(f.calls[0], /deliveries\/get\?delivery_reference=XA1&carrierid=7/);
  const byOrder = await fetchWtTracking(
    { number: 'XY99', carrier: 'GEODIS', order: '6550963', key: 'k', wtCarriers: carriers },
    f,
  );
  assert.equal(byOrder.delivered, true);
  assert.match(f.calls.at(-1), /orders\/get\?order_reference=6550963/);
  assert.equal(
    (await fetchWtTracking({ number: 'X', carrier: 'GEODIS', key: 'k', wtCarriers: carriers }, f))
      .status,
    'not-found',
  );
  assert.equal(
    (await fetchWtTracking({ number: 'X', carrier: 'TNT', key: '' }, f)).status,
    'not-configured',
  );
});

test('Suivi de tous les transporteurs par Welcometrack', async () => {
  const wt = { WELCOMETRACK_API_KEY: 'k' };
  assert.equal(trackingProvider('CHRONOPOST', { ...wt, LAPOSTE_OKAPI_KEY: 'x' }), 'welcometrack');
  assert.equal(trackingProvider('TNT FRANCE', wt), 'welcometrack');
  assert.equal(trackingProvider('FEDEX', {}), 'welcometrack');
  const f = fakeFetch(() => ({ json: { traces: [] } }));
  const r = await fetchTracking('welcometrack', 'XA1', wt, f, {
    carrier: 'COLISSIMO',
    wtCarriers: carriers,
  });
  assert.equal(r.status, 'ok');
});

test('Expéditions de l’alerte comptées par mois et par transporteur', () => {
  const rows = [
    { provider_name: 'Chronopost', delivery_shipmentdate: '02/11/2026' },
    { provider_name: 'Chronopost', delivery_shipmentdate: '30/11/2026' },
    { provider_name: 'TNT', delivery_shipmentdate: '15/10/2026' },
    { provider_name: 'DPD', delivery_shipmentdate: '15/10/2026' },
    { provider_name: '', delivery_shipmentdate: '15/10/2026' },
  ];
  const { months, skipped } = countShipments(rows, ['CHRONOPOST', 'TNT FRANCE']);
  assert.deepEqual(months, {
    '2026-11': { CHRONOPOST: 2 },
    '2026-10': { 'TNT FRANCE': 1, DPD: 1 },
  });
  assert.equal(skipped, 1);
  // Colonnes nommées autrement dans l'export de l'alerte
  assert.deepEqual(
    countShipments([{ Transporteur: 'Colissimo', 'Date expédition': '01/09/2026' }], ['COLISSIMO'])
      .months,
    { '2026-09': { COLISSIMO: 1 } },
  );
});

test('Alerte lue page par page, en lecture seule', async () => {
  const f = fakeFetch((u) => ({
    json: {
      nbpage: 2,
      deliveries: [
        {
          provider_name: 'TNT',
          delivery_shipmentdate: '01/11/2026',
          p: u.searchParams.get('page'),
        },
      ],
    },
  }));
  const { rows } = await fetchAlertRows('42', 'k', f);
  assert.equal(rows.length, 2);
  assert.deepEqual(f.calls, [
    '/v6.0/alerts/get?alertid=42&page=1',
    '/v6.0/alerts/get?alertid=42&page=2',
  ]);
  const refused = await fetchAlertRows(
    '42',
    'k',
    fakeFetch(() => ({ status: 401 })),
  );
  assert.match(refused.error, /refusée/);
  assert.deepEqual(normalizeAlertId(' 123 '), { alertId: '123' });
  assert.match(normalizeAlertId('abc').error, /nombre/);
});
