import test from 'node:test';
import assert from 'node:assert/strict';
import { claimImported } from '../app/claim-imported.mjs';

const imported = {
  id: 'a',
  ref: 'IMP-1',
  importedAt: '2026-11-12T10:00:00.000Z',
  requester: 'Lenny Chancholle',
  creator: 'seedy@sites.test',
  rev: 2,
  history: [],
};
const lenny = { email: 'L.Chancholle@cybertek.fr', name: 'Lenny CHANCHOLLE' };

test('Compte ajouté : ses dossiers importés lui sont rattachés', () => {
  const r = claimImported(imported, lenny, 'Admin');
  assert.equal(r.requesterEmail, 'l.chancholle@cybertek.fr');
  assert.equal(r.creator, 'l.chancholle@cybertek.fr');
  assert.equal(r.requester, 'Lenny CHANCHOLLE');
  assert.equal(r.rev, 3);
  assert.match(r.history.at(-1).text, /rattaché au compte de Lenny CHANCHOLLE/);
  assert.equal(r.history.at(-1).author, 'Admin');
});

test('Nom avec accents ou majuscules différents : même personne', () => {
  const r = claimImported(
    { ...imported, requester: 'Jérémy  Santoro' },
    {
      email: 'j.santoro@cybertek.fr',
      name: 'Jeremy SANTORO',
    },
  );
  assert.equal(r.requesterEmail, 'j.santoro@cybertek.fr');
});

test('Pas de rattachement : autre nom, dossier créé dans l’outil, demandeur déjà rattaché', () => {
  assert.equal(claimImported({ ...imported, requester: 'Anthony Clef' }, lenny), null);
  assert.equal(claimImported({ ...imported, importedAt: undefined }, lenny), null);
  assert.equal(claimImported({ ...imported, requesterEmail: 'x@cybertek.fr' }, lenny), null);
  assert.equal(claimImported(imported, { email: 'l.chancholle@cybertek.fr', name: ' ' }), null);
});
