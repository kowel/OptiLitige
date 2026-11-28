import test from 'node:test';
import assert from 'node:assert/strict';
import { relanceKind, relanceRows, relanceStats } from '../app/relances.mjs';

const T = ['Agent Litige'];
const kind = (t) => relanceKind(t, T).c;

test('relances : demandes de nouvelles reconnues', () => {
  for (const t of [
    '@Agent Litige a-t-on des nouvelles du dossier ?',
    '@Agent Litige tu as des news ?',
    '@Agent Litige du nouveau ?',
    '@Agent Litige un retour ?',
    '@Agent Litige ?',
    'Bonjour @Agent Litige je me permets de relancer ce dossier.',
    '@Agent Litige toujours pas de retour ?',
    "@Agent Litige je n'ai toujours pas l'avoir",
    '@Agent Litige où en est-on ?',
    '@Agent Litige tu as pu transmettre ?',
    '@Agent Litige ça fait 3 semaines, le client nous relance',
  ])
    assert.equal(kind(t), 'relance', t);
});

test('relances : informations et demandes nouvelles ne comptent pas', () => {
  for (const t of [
    '@Agent Litige le colis est arrivé, on peut clôturer.',
    '@Agent Litige possible de faire un avoir stp ?',
    '@Agent Litige photos ajoutées en pièce jointe',
    'Merci @Agent Litige',
    '@Agent Litige',
    '@Agent Litige pourrais-tu relancer le transporteur ?',
  ])
    assert.equal(kind(t), 'autre', t);
});

test('relances : client qui s’impatiente', () => {
  assert.equal(relanceKind('@Agent Litige le client nous appelle tous les jours', T).client, true);
  assert.equal(relanceKind('@Agent Litige la cliente nous met en demeure', T).client, true);
  assert.equal(relanceKind('@Agent Litige photos ajoutées', T).client, false);
});

const members = [
  { email: 'litige@ex.fr', name: 'Agent Litige', role: 'Service Litige' },
  { email: 'rc@ex.fr', name: 'Agent RC', role: 'RC' },
  { email: 'resp@ex.fr', name: 'Chef Exemple', role: 'Responsable' },
];

test('relances : lignes, cible, délai de réponse et historique classé', () => {
  const records = [
    {
      id: 'a',
      ref: 'LIT-1',
      comments: [
        {
          id: 'c1',
          author: 'Agent RC',
          email: 'rc@ex.fr',
          date: '2026-11-01T10:00:00Z',
          text: '@Agent Litige des nouvelles ?',
          mentions: ['litige@ex.fr'],
        },
        {
          id: 'c2',
          author: 'Agent Litige',
          email: 'litige@ex.fr',
          date: '2026-11-01T14:00:00Z',
          text: 'Pas encore.',
        },
        {
          id: 'c3',
          author: 'Agent RC',
          email: 'rc@ex.fr',
          date: '2026-11-02T10:00:00Z',
          text: 'Rien à voir, pas de tag',
        },
        // Historique SharePoint : nom de l'ancienne personne du Service Litige, classé à la lecture
        {
          id: 'c4',
          author: 'Ancien Agent (SharePoint)',
          date: '2026-11-03T10:00:00Z',
          text: '@Personne HISTO le colis est arrivé ?',
        },
        // Un Responsable qui relance ne compte pas : seuls la RC et le SAV relancent
        {
          id: 'c5',
          author: 'Chef Exemple',
          email: 'resp@ex.fr',
          date: '2026-11-04T10:00:00Z',
          text: '@Agent Litige des nouvelles ?',
          mentions: ['litige@ex.fr'],
        },
      ],
    },
  ];
  const rows = relanceRows(records, members, {
    cibles: ['Personne HISTO'],
    items: { c4: { c: 'information', client: false } },
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => [r.commentId, r.relance, r.service, r.replyHours, r.source]),
    [
      ['c1', true, 'RC', 4, 'regles'],
      ['c4', false, 'RC / SAV (sans compte)', null, 'historique'],
    ],
  );
  const s = relanceStats(rows);
  assert.equal(s.tags, 2);
  assert.equal(s.relances, 1);
  assert.equal(s.share, 50);
  assert.equal(s.medianReplyHours, 4);
  assert.equal(s.byService[0].key, 'RC');
  assert.equal(s.topDossiers[0].ref, 'LIT-1');
});

test('relances : repère « client qui s’impatiente » posé par la RC', async () => {
  const { setImpatience, impatientAt } = await import('../app/impatience.mjs');
  const rc = { email: 'rc@ex.fr', name: 'Agent RC', role: 'RC' };
  const r = { id: 'b', ref: 'LIT-2', status: 'Pris en charge', comments: [] };
  // Réservé à la RC et au SAV
  assert.ok(
    setImpatience({ ...r }, true, { ...rc, role: 'Service Litige' }, '2026-11-05T09:00:00Z'),
  );
  assert.equal(setImpatience(r, true, rc, '2026-11-05T09:00:00Z'), null);
  assert.equal(r.clientImpatient, true);
  assert.match(r.history.at(-1).text, /signalé/);
  setImpatience(r, false, rc, '2026-11-07T09:00:00Z');
  assert.equal(r.clientImpatient, false);
  assert.equal(impatientAt(r, '2026-11-04T09:00:00Z'), false);
  assert.equal(impatientAt(r, '2026-11-05T08:30:00Z'), true); // posé dans l'heure qui suit
  assert.equal(impatientAt(r, '2026-11-06T09:00:00Z'), true);
  assert.equal(impatientAt(r, '2026-11-08T09:00:00Z'), false);
  // Une relance faite pendant que le repère est posé compte « client qui s'impatiente »
  r.comments = [
    {
      id: 'd1',
      author: 'Agent RC',
      email: 'rc@ex.fr',
      date: '2026-11-06T10:00:00Z',
      text: '@Agent Litige des nouvelles ?',
      mentions: ['litige@ex.fr'],
    },
    {
      id: 'd2',
      author: 'Agent RC',
      email: 'rc@ex.fr',
      date: '2026-11-09T10:00:00Z',
      text: '@Agent Litige des nouvelles ?',
      mentions: ['litige@ex.fr'],
    },
  ];
  const rows = relanceRows([r], members);
  assert.deepEqual(
    rows.map((x) => [x.commentId, x.client, x.flagged]),
    [
      ['d1', true, true],
      ['d2', false, false],
    ],
  );
  // Un dossier résolu ne peut pas être signalé
  assert.ok(setImpatience({ status: 'Résolu' }, true, rc, '2026-11-10T09:00:00Z'));
});
