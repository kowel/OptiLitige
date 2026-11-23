import test from 'node:test';
import assert from 'node:assert/strict';
import { carrierLimitHours, groupStats, statsCsv } from '../app/stats.mjs';

const now = Date.parse('2026-11-30T12:00:00Z');
const d = (day, h = 0) => new Date(Date.UTC(2026, 10, day, h)).toISOString();
const records = [
  {
    origin: 'Transport',
    carrier: 'DPD',
    brand: 'CYBERTEK',
    assignee: 'li@x.fr',
    status: 'Résolu',
    created: d(1),
    closed: d(11),
    resolution: { verdict: 'Avéré' },
    carrierSentAt: d(2),
    carrierReplyAt: d(7), // 5 jours
    compensation: 80,
    creditIssued: true,
    credit: 100,
    credits: [{ status: 'issued', imputation: 'Transporteur', amount: 100, approvedAmount: 100 }],
  },
  {
    origin: 'Transport',
    carrier: 'DPD',
    brand: 'GROSBILL',
    status: 'Résolu',
    created: d(3),
    closed: d(5),
    resolution: { verdict: 'Non avéré' },
    carrierSentAt: d(3),
    carrierReplyAt: d(23), // 20 jours : hors délai
  },
  {
    origin: 'Transport',
    carrier: 'COLISSIMO',
    brand: 'CYBERTEK',
    status: 'Pris en charge',
    created: d(1),
    carrierSentAt: d(10), // sans réponse depuis 20 jours : hors délai
  },
  { origin: 'Interne', brand: 'CYBERTEK', status: 'Nouveau', created: d(20) },
];

test('Par transporteur : avérés, délais, réponses, récupération', () => {
  const { rows, total } = groupStats(records, 'carrier', { now });
  assert.deepEqual(
    rows.map((r) => r.key),
    ['DPD', 'COLISSIMO'],
  ); // les dossiers internes sont exclus
  const dpd = rows[0];
  assert.equal(dpd.total, 2);
  assert.equal(dpd.foundedRate, 50);
  assert.equal(dpd.avgResolutionDays, 6); // (10 + 2) / 2
  assert.equal(dpd.avgReplyDays, 12.5); // (5 + 20) / 2
  assert.equal(dpd.lateReplies, 1);
  assert.equal(dpd.onTimeRate, 50);
  assert.equal(dpd.compensation, 80);
  assert.equal(dpd.carrierCredits, 100);
  assert.equal(dpd.recoveryRate, 80);
  assert.equal(rows[1].onTimeRate, 0);
  assert.equal(rows[1].foundedRate, null); // rien de qualifié
  assert.equal(total.total, 3);
});

test('Par enseigne et par agent (avec noms)', () => {
  const brand = groupStats(records, 'brand', { now });
  assert.deepEqual(
    brand.rows.map((r) => [r.key, r.total]),
    [
      ['CYBERTEK', 3],
      ['GROSBILL', 1],
    ],
  );
  const agents = groupStats(records, 'assignee', {
    now,
    label: (e) => (e === 'li@x.fr' ? 'Léa' : e),
  });
  assert.deepEqual(agents.rows.map((r) => r.key).sort(), ['Léa', 'Non attribué']);
});

test('Délai transporteur : règle SLA active, sinon 15 jours', () => {
  assert.equal(carrierLimitHours([]), 360);
  assert.equal(carrierLimitHours([{ kind: 'carrier', hours: 48, enabled: true }]), 48);
  assert.equal(carrierLimitHours([{ kind: 'carrier', hours: 48, enabled: false }]), 360);
  // Avec 48 h, la réponse en 5 jours devient hors délai
  const strict = groupStats(records, 'carrier', {
    now,
    rules: [{ kind: 'carrier', hours: 48, enabled: true }],
  });
  assert.equal(strict.rows[0].lateReplies, 2);
});

test('Export CSV lisible dans Excel', () => {
  const csv = statsCsv(groupStats(records, 'carrier', { now }), 'Transporteur');
  const lines = csv.split('\r\n');
  assert.ok(lines[0].startsWith('﻿"Transporteur";"Dossiers"'));
  // Dossiers, part des dossiers (%), en cours
  assert.ok(lines[1].startsWith('"DPD";"2";"66,7";"0"'));
  assert.ok(lines[0].includes('"Dossiers transmis au transporteur"'));
  assert.ok(lines[0].includes('"Reste à notre charge (€)"'));
  assert.ok(lines[1].includes('"12,5"'));
  assert.ok(lines.at(-1).startsWith('"Total";"3"'));
});
