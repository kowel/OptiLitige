import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONTENTIEUX_SETTINGS,
  applyContentieuxAction,
  applyContentieuxRenames,
  normalizeContentieuxSettings,
  checkContentieux,
  contentieuxDashboard,
  contentieuxReport,
  contentieuxReportRanks,
  contentieuxReportTiles,
  contentieuxRows,
  contentieuxStats,
  countByCustomer,
  daysLeft,
  dueDate,
  lossOf,
  matchingDossiers,
  sameCustomer,
} from '../app/contentieux.mjs';

const today = '2026-11-20';
const input = {
  receivedAt: '2026-11-10',
  kind: 'Médiation',
  customerAccount: '2387640',
  order: '6095349',
  amount: '919,91',
  subject: 'Transporteur',
  subSubject: 'Colis endommagé',
};
const ctx = {
  now: '2026-11-20T10:00:00.000Z',
  today,
  author: 'Sophie Morel',
  newId: 'abcdef12-0000',
};

test('saisie : date, type, sous-sujet du bon sujet, montants', () => {
  const { values, error } = checkContentieux(input, today);
  assert.equal(error, undefined);
  assert.equal(values.amount, 919.91);
  assert.equal(values.status, 'À traiter');
  assert.equal(values.refund, null);
  assert.match(checkContentieux({ ...input, receivedAt: '2026-11-21' }, today).error, /futur/);
  assert.match(checkContentieux({ ...input, kind: 'Procès' }, today).error, /type/);
  assert.match(
    checkContentieux({ ...input, subSubject: 'Panne au déballage' }, today).error,
    /sous-sujet du sujet « Transporteur »/,
  );
  assert.match(
    checkContentieux({ ...input, customerAccount: '', order: '' }, today).error,
    /compte client ou le n° de commande/,
  );
  assert.match(checkContentieux({ ...input, status: 'Clos' }, today).error, /décision/);
  assert.equal(checkContentieux({ ...input, priceGap: '-12,5' }, today).values.priceGap, -12.5);
  assert.match(checkContentieux({ ...input, fees: '-3' }, today).error, /Montant frais invalide/);
});

test('date limite de réponse selon le type, en retard ou non', () => {
  assert.equal(dueDate({ receivedAt: '2026-11-10', kind: 'Médiation' }), '2026-12-01');
  assert.equal(dueDate({ receivedAt: '2026-11-10', kind: 'Signal Conso (DGCCRF)' }), '2026-12-10');
  assert.equal(
    daysLeft({ receivedAt: '2026-11-01', kind: 'Réclamation PayPal', status: 'À traiter' }, today),
    -9,
  );
  assert.equal(
    daysLeft({ receivedAt: '2026-11-01', kind: 'Réclamation PayPal', status: 'Répondu' }, today),
    null,
  );
  const s = contentieuxStats(
    [
      {
        receivedAt: '2026-11-01',
        kind: 'Réclamation PayPal',
        status: 'À traiter',
        refund: 10,
        fees: 5.86,
      },
      { receivedAt: '2026-11-18', kind: 'Réclamation PayPal', status: 'À traiter', surcharge: 245 },
      { receivedAt: '2026-10-01', kind: 'Médiation', status: 'Clos', refund: 100 },
    ],
    today,
  );
  assert.deepEqual(
    { open: s.open, late: s.late, soon: s.soon, refund: s.refund, extra: s.extra },
    { open: 2, late: 1, soon: 0, refund: 110, extra: 250.86 },
  );
});

test('liaison proposée avec le dossier de la même commande, sauf refusé ou déjà relié', () => {
  const records = [
    { id: 'd1', order: 'CMD-6095349' },
    { id: 'd2', order: '6095349 ' },
    { id: 'd3', order: '6000000' },
  ];
  assert.deepEqual(
    matchingDossiers({ order: '6095349' }, records).map((r) => r.id),
    ['d1', 'd2'],
  );
  assert.deepEqual(
    matchingDossiers({ order: '6095349', declined: ['d1'] }, records).map((r) => r.id),
    ['d2'],
  );
  assert.deepEqual(matchingDossiers({ order: '6095349', dossierId: 'd1' }, records), []);
  assert.deepEqual(matchingDossiers({ order: '' }, records), []);
});

test('un client et ses autres contentieux ; même type sur la même commande signalé', () => {
  const list = [
    {
      id: 'a',
      customerAccount: '2387640',
      order: '6095349',
      kind: 'Médiation',
      receivedAt: '2026-10-01',
    },
    {
      id: 'b',
      customerAccount: '02387640',
      order: '6100000',
      kind: 'Demande PayPal',
      receivedAt: '2026-11-01',
    },
    {
      id: 'c',
      customerAccount: '999',
      order: '6095349',
      kind: 'Médiation',
      receivedAt: '2026-11-02',
    },
  ];
  const { others, same } = sameCustomer(
    { customerAccount: '2387640', order: '6095349', kind: 'Médiation' },
    list,
  );
  assert.deepEqual(
    others.map((x) => x.id),
    ['b', 'a'],
  );
  assert.deepEqual(
    same.map((x) => x.id),
    ['a'],
  );
  // Sans compte client : rapprochement par commande
  assert.deepEqual(
    sameCustomer({ order: '6095349' }, list).others.map((x) => x.id),
    ['c', 'a'],
  );
  assert.equal(countByCustomer(list)({ customerAccount: '2387640' }), 2);
});

test('création, modification (historique), liaison, refus et retrait', () => {
  const created = applyContentieuxAction(
    null,
    { action: 'contentieux-save', contentieux: input, declined: ['d9'] },
    { ...ctx, dossier: { id: 'd1', ref: 'LIT-2026-1' } },
  ).item;
  assert.equal(created.ref, 'CT-2026-ABCDEF');
  assert.equal(created.dossierRef, 'LIT-2026-1');
  assert.deepEqual(created.declined, ['d9']);
  assert.equal(created.history.length, 2);
  const stale = applyContentieuxAction(
    created,
    { action: 'contentieux-save', version: 0, contentieux: input },
    ctx,
  );
  assert.equal(stale.status, 409);
  const edited = applyContentieuxAction(
    created,
    {
      action: 'contentieux-save',
      version: 1,
      contentieux: { ...input, status: 'Répondu', refund: '919.91', decision: 'Remboursement' },
    },
    ctx,
  ).item;
  assert.equal(edited.version, 2);
  assert.match(edited.history.at(-1).text, /Statut : À traiter → Répondu/);
  assert.match(edited.history.at(-1).text, /Montant remboursé \/ avoir : \(vide\) → 919,91/);
  const unlinked = applyContentieuxAction(edited, { action: 'contentieux-unlink' }, ctx).item;
  assert.equal(unlinked.dossierId, undefined);
  assert.ok(unlinked.declined.includes('d1'));
  const relinked = applyContentieuxAction(
    unlinked,
    { action: 'contentieux-link', dossierId: 'd1' },
    { ...ctx, dossier: { id: 'd1', ref: 'LIT-2026-1' } },
  ).item;
  assert.equal(relinked.dossierId, 'd1');
  assert.ok(!relinked.declined.includes('d1'));
  const declined = applyContentieuxAction(
    { ...created, dossierId: undefined },
    { action: 'contentieux-decline', dossierId: 'd2' },
    ctx,
  ).item;
  assert.ok(declined.declined.includes('d2'));
});

test('export : colonnes du fichier Excel, délai et dossier relié', () => {
  const { headers, rows } = contentieuxRows([
    { ref: 'CT-1', receivedAt: '2026-11-10', kind: 'Médiation', dossierRef: 'LIT-1' },
  ]);
  assert.equal(headers.length, rows[0].length);
  assert.equal(rows[0][headers.indexOf('Délai légal de réponse')], '21 jours');
  assert.equal(rows[0][headers.indexOf('Date limite de réponse')], '2026-12-01');
  assert.equal(rows[0][headers.indexOf('Dossier litige relié')], 'LIT-1');
});

test('listes réglables : nouveau sous-sujet, type retiré gardé sur un contentieux existant', () => {
  const settings = normalizeContentieuxSettings({
    ...DEFAULT_CONTENTIEUX_SETTINGS,
    kinds: [{ id: 'Médiation', risk: 4, days: 30 }],
    subjects: [{ name: 'Transporteur', subs: ['Colis endommagé', 'Colis bloqué en douane'] }],
    decisions: ['Remboursement'],
  }).settings;
  // Nouveau sous-sujet accepté ; délai et risque du type retenus à l'enregistrement
  const { values } = checkContentieux(
    { ...input, subSubject: 'Colis bloqué en douane' },
    today,
    settings,
  );
  assert.equal(values.legalDays, 30);
  assert.equal(values.risk, 4);
  // Type retiré des listes : refusé pour un nouveau contentieux, gardé sur un ancien
  const old = { ...input, kind: 'Demande PayPal', legalDays: 14, risk: 2 };
  assert.match(checkContentieux(old, today, settings).error, /type/);
  const kept = checkContentieux(old, today, settings, old).values;
  assert.equal(kept.kind, 'Demande PayPal');
  assert.equal(kept.legalDays, 14);
  assert.equal(dueDate({ ...kept }, settings), '2026-11-24');
  // Délai changé dans les Paramètres : la date limite d'un contentieux déjà reçu ne bouge pas
  assert.equal(
    checkContentieux(input, today, settings, { ...input, legalDays: 21 }).values.legalDays,
    21,
  );
});

test('paramètres : vérification et renommage dans les contentieux saisis', () => {
  assert.match(
    normalizeContentieuxSettings({ ...DEFAULT_CONTENTIEUX_SETTINGS, kinds: [] }).error,
    /au moins un type/,
  );
  assert.match(
    normalizeContentieuxSettings({
      ...DEFAULT_CONTENTIEUX_SETTINGS,
      kinds: [{ id: 'X', risk: 9, days: 10 }],
    }).error,
    /de 1 à 6/,
  );
  assert.match(
    normalizeContentieuxSettings({ ...DEFAULT_CONTENTIEUX_SETTINGS, decisions: ['A', 'a'] }).error,
    /même nom/,
  );
  const changed = applyContentieuxRenames(
    [
      { id: '1', version: 3, subject: 'Transporteur', subSubject: 'Colis perdu', history: [] },
      { id: '2', version: 1, subject: 'SAV PC', subSubject: 'Colis perdu', history: [] },
    ],
    [{ field: 'subSubject', subject: 'Transporteur', from: 'Colis perdu', to: 'Colis égaré' }],
    { now: ctx.now, author: 'Sophie Morel' },
  );
  assert.equal(changed.length, 1);
  assert.equal(changed[0].subSubject, 'Colis égaré');
  assert.equal(changed[0].version, 4);
  assert.match(changed[0].history[0].text, /Sous-sujet : Colis perdu → Colis égaré/);
});

test('perte réelle : coût moins l’indemnisation transporteur du dossier relié', () => {
  const records = [
    { id: 'd1', compensation: 250 },
    { id: 'd2', compensation: 1000 },
  ];
  const a = { id: 'a', refund: 919.91, fees: 5.86, surcharge: 0, dossierId: 'd1' };
  assert.deepEqual(lossOf(a, records), {
    cost: 925.77,
    compensation: 250,
    deducted: 250,
    loss: 675.77,
  });
  // Indemnisation plus forte que le coût : perte nulle, jamais négative
  assert.equal(lossOf({ refund: 100, dossierId: 'd2' }, records).loss, 0);
  // Sans dossier relié : rien n'est déduit
  assert.equal(lossOf({ refund: 100 }, records).loss, 100);
  // Deux contentieux reliés au même dossier : l'indemnisation n'est déduite qu'une fois
  const s = contentieuxStats(
    [
      { ...a, status: 'Clos' },
      { id: 'b', refund: 100, dossierId: 'd1', status: 'Clos' },
      { id: 'c', refund: 50, status: 'Clos' },
    ],
    today,
    undefined,
    records,
  );
  assert.deepEqual(
    { cost: s.cost, deducted: s.deducted, loss: s.loss },
    { cost: 1075.77, deducted: 250, loss: 825.77 },
  );
  const { headers, rows } = contentieuxRows([a], undefined, records);
  assert.equal(rows[0][headers.indexOf('Perte réelle')], 675.77);
});

test('tableau de bord : volumes, montants par type, mois et années', () => {
  const list = [
    {
      id: '1',
      kind: 'Médiation',
      receivedAt: '2026-11-02',
      subject: 'Transporteur',
      subSubject: 'Colis perdu',
      brand: 'CYBERTEK',
      refund: 100,
      fees: 5.86,
      status: 'Clos',
      decision: 'Remboursement',
      dossierId: 'd1',
    },
    {
      id: '2',
      kind: 'Médiation',
      receivedAt: '2026-10-15',
      subject: 'Transporteur',
      subSubject: 'Colis perdu',
      brand: 'GROSBILL',
      surcharge: 245,
      status: 'Répondu',
    },
    {
      id: '3',
      kind: 'Demande PayPal',
      receivedAt: '2025-03-01',
      subject: 'Rétractation',
      subSubject: '',
      status: 'Clos',
      decision: 'Avoir',
      refund: 50,
    },
  ];
  const d = contentieuxDashboard(list, [{ id: 'd1', compensation: 30 }], undefined, today);
  assert.equal(d.total, 3);
  assert.deepEqual(
    d.byKind.map((r) => [r.label, r.value]),
    [
      ['Médiation', 2],
      ['Demande PayPal', 1],
    ],
  );
  assert.deepEqual(d.bySubSubject, [{ label: 'Transporteur › Colis perdu', value: 2 }]);
  const med = d.byKindMoney.find((r) => r.kind === 'Médiation');
  assert.deepEqual(
    { cost: med.cost, loss: med.loss, surcharge: med.surcharge },
    { cost: 350.86, loss: 320.86, surcharge: 245 },
  );
  assert.equal(d.loss, 370.86);
  // 12 derniers mois : novembre 2026 en dernier ; mars 2025 hors fenêtre
  assert.equal(d.months.length, 12);
  assert.equal(d.months.at(-1).key, '2026-11');
  assert.equal(d.months.at(-1).byKind['Médiation'], 1);
  assert.equal(
    d.months.reduce((s, m) => s + m.total, 0),
    2,
  );
  assert.deepEqual(d.years, ['2026', '2025']);
  assert.deepEqual(d.byYear.find((r) => r.kind === 'Demande PayPal').years, { 2026: 0, 2025: 1 });
});

test('rapport des contentieux : période comparée à la précédente', () => {
  const list = [
    {
      kind: 'Médiation',
      receivedAt: '2026-10-05',
      status: 'Clos',
      decision: 'Remboursement',
      refund: 200,
      subject: 'Transporteur',
      subSubject: 'Colis perdu',
    },
    {
      kind: 'Demande PayPal',
      receivedAt: '2026-10-20',
      status: 'À traiter',
      fees: 14,
      subject: 'Transporteur',
    },
    { kind: 'Demande PayPal', receivedAt: '2026-09-12', status: 'Clos', refund: 50 },
  ];
  const oct = { key: '2026-10', from: '2026-10-01', to: '2026-11-01', label: 'octobre 2026' };
  const sep = { key: '2026-09', from: '2026-09-01', to: '2026-10-01', label: 'septembre 2026' };
  const data = contentieuxReport(list, [], oct, sep, ['Enseigne : CYBERTEK'], undefined, today);
  assert.deepEqual(
    {
      received: data.now.received,
      highRisk: data.now.highRisk,
      treatedRate: data.now.treatedRate,
      cost: data.now.cost,
    },
    { received: 2, highRisk: 1, treatedRate: 50, cost: 214 },
  );
  assert.equal(data.before.received, 1);
  const tiles = contentieuxReportTiles(data);
  assert.equal(tiles.length, 9);
  assert.deepEqual(tiles[0], {
    label: 'Contentieux reçus',
    value: '2',
    delta: { dir: 'up', text: '100 %', tone: 'worse' },
  });
  const ranks = contentieuxReportRanks(data);
  assert.deepEqual(ranks[0].rows, [
    ['Demande PayPal', 1],
    ['Médiation', 1],
  ]);
  assert.deepEqual(ranks[2].rows, [['Colis perdu', 1]]);
});

test('message du client et réponse apportée : enregistrés, exportés, « modifié » dans l’historique', () => {
  const message = 'Bonjour,\nje n’ai toujours pas reçu mon colis.';
  const { values } = checkContentieux(
    { ...input, customerMessage: '  ' + message + '  ', customerReply: 'Colis renvoyé.' },
    today,
  );
  assert.equal(values.customerMessage, message);
  assert.equal(values.customerReply, 'Colis renvoyé.');
  assert.match(
    checkContentieux({ ...input, customerMessage: 'x'.repeat(20001) }, today).error,
    /Message client/,
  );
  const created = applyContentieuxAction(
    null,
    { action: 'contentieux-save', contentieux: input },
    ctx,
  ).item;
  const saved = applyContentieuxAction(
    created,
    {
      action: 'contentieux-save',
      version: created.version,
      contentieux: { ...input, customerMessage: message, customerReply: 'Colis renvoyé.' },
    },
    ctx,
  ).item;
  const last = saved.history[saved.history.length - 1].text;
  assert.match(last, /Message client : \(vide\) → modifié/);
  assert.match(last, /Réponse apportée au client : \(vide\) → modifié/);
  const { headers, rows } = contentieuxRows([saved]);
  assert.equal(rows[0][headers.indexOf('Message client')], message);
  assert.equal(rows[0][headers.indexOf('Réponse apportée au client')], 'Colis renvoyé.');
});
