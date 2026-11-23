// Rappels, client récidiviste, modèles de réclamation, actions groupées, Ma journée, rapports
import test from 'node:test';
import assert from 'node:assert/strict';
import { addReminder, dueReminders, removeReminder } from '../app/reminders.mjs';
import { customerKey, repeatInfo, normalizeRepeatAlerts } from '../app/repeat-customer.mjs';
import {
  DEFAULT_CLAIM_TEMPLATES,
  fillTemplate,
  normalizeTemplates,
  placeholderValues,
  suggestTemplate,
} from '../app/claim-templates.mjs';
import { applyBulk, normalizeBulk } from '../app/bulk-actions.mjs';
import { buildMyDay } from '../app/my-day.mjs';
import { buildAlerts, ALERT_KEY_PATTERN } from '../app/alerts.mjs';
import {
  buildReport,
  buildReportAlerts,
  lastClosedPeriod,
  monthPeriod,
  normalizeReports,
  previousPeriod,
} from '../app/reports.mjs';

const NOW = Date.parse('2026-11-12T10:00:00Z');
const rec = (extra) => ({
  id: 'd1',
  ref: 'LIT-1',
  title: 'Écran cassé',
  status: 'Pris en charge',
  created: '2026-11-01T10:00:00Z',
  customer: 'Paul Durand',
  type: 'Colis cassé',
  history: [],
  comments: [],
  ...extra,
});

test('rappels : ajout, échéance, suppression', () => {
  const now = new Date(NOW).toISOString();
  assert.ok(addReminder([], { recordId: 'd1', date: '2026-11-01' }, { id: 'r', now }).error);
  const { list } = addReminder(
    [],
    { recordId: 'd1', date: '2026-11-12', note: ' Rappeler  le client ' },
    { id: 'r1', now },
  );
  assert.equal(list[0].note, 'Rappeler le client');
  const later = addReminder(list, { recordId: 'd1', date: '2026-11-20' }, { id: 'r2', now }).list;
  const due = dueReminders(later, [rec()], { now: NOW });
  assert.equal(due.length, 1);
  assert.equal(due[0].title, 'Rappel : LIT-1');
  assert.ok(ALERT_KEY_PATTERN.test(due[0].key));
  assert.equal(removeReminder(later, 'r1').list.length, 1);
  assert.equal(
    buildAlerts([rec()], { email: 'a@b.fr', role: 'RC' }, { reminders: list, now: NOW }).reminders
      .length,
    1,
  );
});

test('client récidiviste', () => {
  assert.equal(customerKey('Durand  Paul'), customerKey('paul DURAND'));
  assert.equal(customerKey('Non renseigné (import)'), '');
  const records = [
    rec({ id: 'a', created: '2026-06-01T10:00:00Z' }),
    rec({ id: 'b', created: '2026-09-01T10:00:00Z', customer: 'Durand Paul' }),
    rec({ id: 'c', created: '2024-01-01T10:00:00Z', outcome: 'Fraude étiquette' }),
  ];
  const settings = { count: 3, months: 12, fraud: true };
  const info = repeatInfo(records, { customer: 'paul durand' }, settings, NOW);
  assert.equal(info.matches.length, 3);
  assert.equal(info.recent, 2);
  assert.ok(info.alert);
  assert.equal(info.reasons.length, 2);
  assert.ok(
    !repeatInfo(
      records.slice(0, 1),
      { customer: 'Paul Durand' },
      { ...settings, fraud: false },
      NOW,
    ).alert,
  );
  assert.ok(normalizeRepeatAlerts({ count: -1, months: 12 }).error);
});

test('modèles de réclamation', () => {
  const r = rec({
    carrier: 'CHRONOPOST',
    bt: 'XN1234567890FR',
    order: '6271961',
    amount: 278.93,
    type: 'Colis perdu',
  });
  assert.equal(suggestTemplate(DEFAULT_CLAIM_TEMPLATES, r).id, 'perte');
  assert.equal(suggestTemplate(DEFAULT_CLAIM_TEMPLATES, { type: 'Inversion' }).id, 'erreur');
  const text = fillTemplate(
    'Colis {numero_suivi}, commande {commande}, {montant}, réf {reference_reclamation}',
    placeholderValues(r, { name: 'Lydia' }),
  );
  assert.match(text, /XN1234567890FR/);
  assert.match(text, /278,93/);
  assert.match(text, /\[à compléter : réf\. de réclamation transporteur\]/);
  assert.ok(normalizeTemplates(DEFAULT_CLAIM_TEMPLATES).templates.length >= 8);
  assert.ok(normalizeTemplates([{ title: '', body: 'x' }]).error);
});

test('actions groupées', () => {
  assert.ok(normalizeBulk({ ids: [], op: 'assign' }).error);
  assert.ok(normalizeBulk({ ids: ['a'], op: 'status', value: 'Résolu' }).error);
  const ctx = { now: '2026-11-12T10:00:00Z', author: 'Lydia', assigneeName: 'Marc' };
  const n = rec({ status: 'Nouveau' });
  assert.equal(applyBulk(n, { op: 'status', value: 'Pris en charge' }, ctx), null);
  assert.equal(n.status, 'Pris en charge');
  assert.equal(n.takenAt, ctx.now);
  assert.match(
    applyBulk(rec({ status: 'Nouveau' }), { op: 'status', value: 'En attente RC' }, ctx),
    /non autorisé/,
  );
  const a = rec();
  assert.equal(applyBulk(a, { op: 'assign', value: 'marc@c.fr' }, ctx), null);
  assert.match(a.history[0].text, /Attribué à Marc/);
  assert.equal(
    applyBulk(rec({ status: 'Résolu' }), { op: 'assign', value: 'x' }, ctx),
    'dossier résolu',
  );
});

test('Ma journée : priorités du Service Litige', () => {
  const rules = [
    {
      id: 'take',
      label: 'Prise en charge',
      kind: 'status',
      status: 'Nouveau',
      hours: 24,
      enabled: true,
    },
  ];
  const records = [
    rec({ id: 'n1', ref: 'LIT-N1', status: 'Nouveau', created: '2026-11-10T10:00:00Z' }),
    rec({ id: 'n2', ref: 'LIT-N2', status: 'Nouveau', created: '2026-11-12T01:00:00Z' }),
    rec({
      id: 'f1',
      ref: 'LIT-F1',
      carrierStatus: 'En attente réponse',
      carrierFollowupAt: '2026-11-11',
    }),
    rec({
      id: 'x',
      ref: 'LIT-X',
      status: 'Nouveau',
      assignee: 'autre@c.fr',
      created: '2026-11-01T10:00:00Z',
    }),
  ];
  const day = buildMyDay(
    records,
    { email: 'lydia@c.fr', name: 'Lydia', role: 'Service Litige' },
    { rules, now: NOW },
  );
  const ids = (id) => day.sections.find((s) => s.id === id).items.map((i) => i.record.id);
  assert.deepEqual(ids('late'), ['n1']);
  assert.deepEqual(ids('soon'), ['n2']);
  assert.deepEqual(ids('new'), ['n1', 'n2']);
  assert.deepEqual(ids('followups'), ['f1']);
  // Un agent RC ne voit pas les sections du service litige
  const rc = buildMyDay(records, { email: 'rc@c.fr', name: 'RC', role: 'RC' }, { rules, now: NOW });
  assert.ok(!rc.sections.some((s) => s.id === 'late'));
});

test('rapports : périodes, chiffres, programmation', () => {
  assert.equal(lastClosedPeriod('monthly', NOW).key, '2026-10');
  assert.equal(lastClosedPeriod('weekly', NOW).key, '2026-11-02');
  assert.equal(previousPeriod(monthPeriod('2026-01')).key, '2025-12');
  const records = [
    rec({
      id: 'a',
      created: '2026-10-05T10:00:00Z',
      status: 'Résolu',
      closed: '2026-10-15T10:00:00Z',
      resolution: { verdict: 'Avéré' },
      carrier: 'TNT',
      brand: 'GROSBILL',
      amount: 100,
      compensation: 50,
      carrierDecision: 'Accepté',
    }),
    rec({
      id: 'b',
      created: '2026-10-20T10:00:00Z',
      carrier: 'DPD',
      brand: 'CYBERTEK',
      amount: 300,
      outcome: 'Fraude étiquette',
    }),
    rec({
      id: 'c',
      created: '2026-09-20T10:00:00Z',
      carrier: 'TNT',
      brand: 'GROSBILL',
      amount: 50,
    }),
  ];
  const all = buildReport(records, monthPeriod('2026-10'));
  assert.equal(all.now.opened, 2);
  assert.equal(all.now.closed, 1);
  assert.equal(all.now.provenRate, 100);
  assert.equal(all.now.compensation, 50);
  assert.equal(all.before.opened, 1);
  const tnt = buildReport(records, monthPeriod('2026-10'), { carrier: 'TNT' });
  assert.equal(tnt.now.opened, 1);
  assert.deepEqual(tnt.filters, ['Transporteur : TNT']);
  // Programmation et destinataires
  const { reports } = normalizeReports(
    [
      {
        name: 'TNT direction',
        frequency: 'monthly',
        filters: { carrier: 'TNT' },
        recipients: { emails: ['dir@c.fr'], roles: ['Service Litige'] },
      },
    ],
    ['dir@c.fr'],
  );
  assert.equal(reports.length, 1);
  assert.ok(normalizeReports([{ name: 'x', recipients: { emails: ['inconnu@c.fr'] } }], []).error);
  assert.ok(normalizeReports([{ name: 'x', recipients: {} }], []).error);
  assert.equal(
    buildReportAlerts(reports, { email: 'dir@c.fr', role: 'RC' }, { now: NOW })[0].period.key,
    '2026-10',
  );
  assert.equal(
    buildReportAlerts(reports, { email: 'l@c.fr', role: 'Service Litige' }, { now: NOW }).length,
    1,
  );
  assert.equal(
    buildReportAlerts(reports, { email: 'rc@c.fr', role: 'RC' }, { now: NOW }).length,
    0,
  );
});

test('client récidiviste : même résultat avec l’index des clients', async () => {
  const { customerIndex } = await import('../app/repeat-customer.mjs');
  const records = [
    rec({ id: 'a', created: '2026-06-01T10:00:00Z' }),
    rec({ id: 'b', created: '2026-09-01T10:00:00Z', customer: 'Durand Paul' }),
    rec({ id: 'c', customer: 'Autre Client' }),
  ];
  const settings = { count: 3, months: 12, fraud: true };
  const direct = repeatInfo(records, { id: 'a', customer: 'Paul Durand' }, settings, NOW);
  const indexed = repeatInfo(
    customerIndex(records),
    { id: 'a', customer: 'Paul Durand' },
    settings,
    NOW,
  );
  assert.deepEqual(
    indexed.matches.map((r) => r.id),
    direct.matches.map((r) => r.id),
  );
  assert.equal(indexed.matches.length, 1);
});

test('rapport par dates : période, période précédente, contrôles', async () => {
  const { rangePeriod, rangeError, previousPeriod, delta, reportFileName } =
    await import('../app/reports.mjs');
  const p = rangePeriod('2026-10-01', '2026-10-15');
  assert.equal(p.from, '2026-10-01');
  assert.equal(p.to, '2026-10-16');
  assert.equal(p.days, 15);
  assert.equal(p.label, 'du 01/10/2026 au 15/10/2026');
  const prev = previousPeriod(p);
  assert.equal(prev.from, '2026-09-16');
  assert.equal(prev.to, '2026-10-01');
  assert.equal(
    rangeError('2026-10-15', '2026-10-01'),
    'La date de début doit précéder la date de fin.',
  );
  assert.ok(rangeError('', '2026-10-01'));
  assert.equal(rangeError('2026-10-01', '2026-10-01'), '');
  assert.deepEqual(delta(10, 8, 'down'), { dir: 'up', text: '25 %', tone: 'worse' });
  assert.equal(delta(0, 0, 'up').text, '—');
  assert.equal(
    reportFileName('Rapport des litiges', { period: p }),
    'OptiLitige - Rapport des litiges - du 01-10-2026 au 15-10-2026.pdf',
  );
});

test('fichier PDF du rapport : structure valide, accents et euros', async () => {
  const { buildReport, monthPeriod } = await import('../app/reports.mjs');
  const { reportPdf } = await import('../app/report-pdf.mjs');
  const records = [
    rec({
      id: 'a',
      created: '2026-10-05T10:00:00Z',
      carrier: 'TNT',
      brand: 'GROSBILL',
      amount: 1250,
    }),
  ];
  const bytes = reportPdf({
    title: 'Rapport « été » — 1 250 €',
    data: buildReport(records, monthPeriod('2026-10')),
  });
  const s = Buffer.from(bytes).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  const xref = Number(s.match(/startxref\n(\d+)/)[1]);
  assert.equal(s.slice(xref, xref + 4), 'xref');
  for (const [i, m] of [...s.slice(xref).matchAll(/(\d{10}) 00000 n/g)].entries())
    assert.ok(s.startsWith(i + 1 + ' 0 obj', Number(m[1])), 'objet ' + (i + 1));
  const len = Number(s.match(/<< \/Length (\d+) >>/)[1]);
  const start = s.indexOf('stream\n') + 7;
  assert.equal(s.slice(start + len, start + len + 10), '\nendstream');
  // « é » = \351, « € » = \200 en WinAnsi
  assert.ok(s.includes(String.raw`\253 \351t\351 \273`));
  assert.ok(s.includes(String.raw`1 250 \200`));
});

test('client récidiviste : reconnu par son numéro de compte, même sans nom', async () => {
  const { repeatInfo, DEFAULT_REPEAT_ALERTS } = await import('../app/repeat-customer.mjs');
  const now = Date.parse('2026-11-13T12:00:00Z');
  const list = [
    {
      id: 'a',
      customerAccount: 'C 0042',
      customer: 'Non renseigné',
      created: '2026-11-01T10:00:00Z',
    },
    { id: 'b', customerAccount: 'c0042', customer: '', created: '2026-10-01T10:00:00Z' },
  ];
  const info = repeatInfo(
    list,
    { id: 'new', customerAccount: 'C0042' },
    DEFAULT_REPEAT_ALERTS,
    now,
  );
  assert.equal(info.matches.length, 2);
});
