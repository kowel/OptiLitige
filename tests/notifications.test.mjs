import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotifications, notificationKey, groupNotifications } from '../app/notifications.mjs';
const me = { email: 'rc@test.example' },
  other = { email: 'litige@test.example' };
const comment = (id, email, mentions = []) => ({
  id,
  email,
  author: email,
  text: 'Message',
  date: '2026-10-28T10:00:00.000Z',
  mentions,
});
const mention = comment('mention-1', other.email, [me.email]);
const record = (id, comments) => ({ id, ref: id, comments });
test('Mention non lue tant que le destinataire n’a pas répondu', () => {
  const r = record('a', [mention]);
  assert.equal(buildNotifications([r], me)[0].unread, true);
  assert.equal(buildNotifications([r], me)[0].unread, true);
});
test('Marquage explicite est ciblé sur une seule notification', () => {
  const r = record('a', [mention, comment('mention-2', other.email, [me.email])]);
  const a = buildNotifications([r], me, [notificationKey('a', 'mention-1')]);
  assert.equal(a.find((x) => x.id === 'mention-1').unread, false);
  assert.equal(a.find((x) => x.id === 'mention-2').unread, true);
});
test('Une réponse sur le même dossier marque les mentions précédentes comme lues', () => {
  const r = record('a', [mention, comment('reply', me.email)]);
  assert.equal(buildNotifications([r], me)[0].unread, false);
});
test('Une réponse sur un autre dossier laisse la notification non lue', () => {
  assert.equal(
    buildNotifications([record('a', [mention]), record('b', [comment('reply', me.email)])], me)[0]
      .unread,
    true,
  );
});
test('La réponse d’un autre agent ne lit pas la notification à la place du destinataire', () => {
  assert.equal(
    buildNotifications([record('a', [mention, comment('reply', other.email)])], me)[0].unread,
    true,
  );
});
test('Nouvelle mention après une réponse redevient non lue, même à horodatage identique', () => {
  const r = record('a', [
    mention,
    comment('reply', me.email),
    comment('mention-2', other.email, [me.email]),
  ]);
  const a = buildNotifications([r], me);
  assert.equal(a.find((x) => x.id === 'mention-1').unread, false);
  assert.equal(a.find((x) => x.id === 'mention-2').unread, true);
});
test('Une réponse antérieure à la mention ne la lit pas', () => {
  assert.equal(
    buildNotifications([record('a', [comment('reply', me.email), mention])], me)[0].unread,
    true,
  );
});
test('Les notifications restent propres au destinataire', () => {
  assert.equal(buildNotifications([record('a', [mention])], other).length, 0);
});

test('Trois mentions consécutives sur un dossier comptent pour une notification', () => {
  const a = groupNotifications(
    [
      record('a', [
        mention,
        comment('m2', other.email, [me.email]),
        comment('m3', other.email, [me.email]),
      ]),
    ],
    me,
  );
  assert.equal(a.length, 1);
  assert.equal(a[0].unread, true);
  assert.equal(a[0].unreadCount, 3);
  assert.equal(a[0].id, 'm3');
  assert.deepEqual(new Set(a[0].unreadIds), new Set(['mention-1', 'm2', 'm3']));
});
test('Deux dossiers restent deux notifications distinctes', () => {
  const a = groupNotifications(
    [record('a', [mention]), record('b', [comment('m2', other.email, [me.email])])],
    me,
  );
  assert.equal(a.filter((x) => x.unread).length, 2);
});
test('Plusieurs auteurs sur un dossier restent un seul groupe', () => {
  const a = groupNotifications(
    [record('a', [mention, comment('m2', 'responsable@test.example', [me.email])])],
    me,
  );
  assert.equal(a.length, 1);
  assert.equal(a[0].unreadCount, 2);
});
test('Marquer le groupe lu ne masque pas une mention arrivée après l’affichage', () => {
  const first = record('a', [mention, comment('m2', other.email, [me.email])]);
  const snapshot = groupNotifications([first], me)[0];
  const keys = snapshot.unreadIds.map((id) => notificationKey('a', id));
  const next = groupNotifications(
    [record('a', [...first.comments, comment('m3', other.email, [me.email])])],
    me,
    keys,
  );
  assert.equal(next.length, 1);
  assert.equal(next[0].unread, true);
  assert.equal(next[0].unreadCount, 1);
  assert.deepEqual(next[0].unreadIds, ['m3']);
});
test('Répondre lit le groupe, une mention ultérieure réactive le même groupe', () => {
  const first = record('a', [
    mention,
    comment('m2', other.email, [me.email]),
    comment('reply', me.email),
  ]);
  assert.equal(groupNotifications([first], me)[0].unread, false);
  const next = groupNotifications(
    [record('a', [...first.comments, comment('m3', other.email, [me.email])])],
    me,
  );
  assert.equal(next.length, 1);
  assert.equal(next[0].unreadCount, 1);
});
