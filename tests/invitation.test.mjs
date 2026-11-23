import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationMail } from '../app/invitation.mjs';

test('Invitation : message prêt avec lien, adresse et service', () => {
  const m = invitationMail(
    { name: 'Lydia Cartier', email: 'l.cartier@exemple.fr', role: 'Service Litige' },
    'https://outil.exemple.fr/',
    'Loic Lebreton',
  );
  assert.equal(m.to, 'l.cartier@exemple.fr');
  assert.match(m.body, /^Bonjour Lydia,/);
  assert.match(m.body, /https:\/\/outil\.exemple\.fr\/\r\n/);
  assert.match(m.body, /l\.cartier@exemple\.fr/);
  assert.match(m.body, /Service Litige : vous traitez/);
  assert.match(m.body, /Loic Lebreton$/);
  assert.ok(m.href.startsWith('mailto:l.cartier@exemple.fr?subject=Votre%20acc'));
  assert.equal(decodeURIComponent(m.href.split('&body=')[1]), m.body);
});

test('Invitation : aucune pour un compte désactivé ou sans adresse', () => {
  assert.equal(
    invitationMail({ name: 'X', email: 'x@exemple.fr', role: 'Désactivé' }, 'https://a'),
    null,
  );
  assert.equal(invitationMail({ name: 'X', email: '', role: 'RC' }, 'https://a'), null);
});
