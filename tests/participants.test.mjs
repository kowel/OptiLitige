import test from 'node:test';
import assert from 'node:assert/strict';
import { participants } from '../app/participants.mjs';

const members = [
  { email: 'claire@x.fr', name: 'Claire Durand', role: 'RC' },
  { email: 'nadia@x.fr', name: 'Nadia Roux', role: 'SAV' },
  { email: 'mathieu@x.fr', name: 'Mathieu Petit', role: 'Service Litige' },
  { email: 'lea@x.fr', name: 'Léa Martin', role: 'Service Litige' },
];

test('Propriétaire = créateur ; intervenants = toutes les autres personnes qui ont agi', () => {
  const record = {
    creator: 'claire@x.fr',
    comments: [
      { email: 'claire@x.fr', author: 'Claire Durand' },
      { email: 'mathieu@x.fr', author: 'Mathieu Petit' },
      { email: 'nadia@x.fr', author: 'Nadia Roux' },
    ],
    transportMessages: [{ author: 'Léa Martin' }],
    attachments: [{ email: 'mathieu@x.fr', author: 'Mathieu Petit' }],
    credits: [
      {
        requestedBy: 'claire@x.fr',
        requestedByName: 'Claire Durand',
        issue: { by: 'lea@x.fr', byName: 'Léa Martin' },
      },
    ],
    history: [{ author: 'Migration' }, { author: 'Claire Durand' }, { author: 'Mathieu Petit' }],
  };
  const p = participants(record, members);
  assert.deepEqual(p.owner, { name: 'Claire Durand', role: 'RC', email: 'claire@x.fr' });
  assert.deepEqual(
    p.others.map((o) => [o.name, o.role, o.actions.sort().join(',')]),
    [
      ['Léa Martin', 'Service Litige', 'avoirs,transporteur'],
      ['Mathieu Petit', 'Service Litige', 'messages,pièces jointes'],
      ['Nadia Roux', 'SAV', 'messages'],
    ],
  );
});

test('Dossier importé ou agent inconnu', () => {
  const p = participants({ creator: 'ancien@x.fr', history: [{ author: 'Migration' }] }, members);
  assert.deepEqual(p.owner, { name: 'ancien@x.fr', role: '', email: 'ancien@x.fr' });
  assert.deepEqual(p.others, []);
  assert.equal(participants({}, members).owner, null);
});

test('échanges : ligne d’ouverture (qui, quand)', async () => {
  const { openingEntry } = await import('../app/participants.mjs');
  const members = [
    { email: 'rc@ex.fr', name: 'Agent RC', role: 'RC' },
    { email: 'import@ex.fr', name: 'Import', role: 'Désactivé' },
  ];
  // Créé dans l'outil : le propriétaire, avec l'heure
  assert.deepEqual(
    openingEntry({ creator: 'rc@ex.fr', created: '2026-11-14T09:32:00.000Z' }, members),
    {
      author: 'Agent RC',
      date: '2026-11-14T09:32:00.000Z',
      withTime: true,
    },
  );
  // Repris de SharePoint, rattaché : le propriétaire, sans heure (date seule)
  const claimed = {
    importedAt: 'x',
    creator: 'rc@ex.fr',
    requester: 'Agent RC',
    requesterEmail: 'rc@ex.fr',
    created: '2025-11-14T00:00:00.000Z',
  };
  assert.equal(openingEntry(claimed, members).withTime, false);
  assert.equal(openingEntry(claimed, members).author, 'Agent RC');
  // Repris, auteur sans compte : son nom SharePoint (pas le compte d'import)
  assert.equal(
    openingEntry(
      {
        importedAt: 'x',
        creator: 'import@ex.fr',
        requester: 'Manon Exemple',
        created: '2025-11-14T00:00:00.000Z',
      },
      members,
    ).author,
    'Manon Exemple',
  );
  assert.equal(openingEntry({ creator: 'rc@ex.fr' }, members), null);
});
