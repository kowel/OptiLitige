import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotifications, notificationKey, groupNotifications } from '../app/notifications.mjs';
test('API notifications : lecture explicite persistante, accès contrôlé et réponse ciblée', async () => {
  const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5174';
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' }),
    cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const get = async () => {
    const r = await fetch(origin + '/api/data', { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    return r.json();
  };
  const post = async (p) => {
    const r = await fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    return { status: r.status, body: await r.json() };
  };
  let d = await get();
  const me = d.me;
  const created = await post({
    action: 'create',
    record: {
      title: 'Test notifications local',
      customer: 'Fictif',
      customerAccount: 'C-TEST',
      order: 'LOCAL-NOTIF',
      amount: 100,
      origin: 'Transport',
      type: 'Inversion',
      brand: 'GROSBILL',
      productType: 'PC',
      description: 'Test local de notification',
    },
  });
  assert.equal(created.status, 200);
  const id = created.body.id;
  let r;
  const refresh = async () => {
    d = await get();
    r = d.records.find((x) => x.id === id);
  };
  await refresh();
  assert.equal(
    (
      await post({
        action: 'comment',
        id,
        version: r.version,
        text: 'Mention invalide',
        mentions: ['absent@test.example'],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post({
        action: 'comment',
        id,
        version: r.version,
        text: 'Mention de test',
        mentions: [me.email],
      })
    ).status,
    200,
  );
  await refresh();
  const first = r.comments.at(-1);
  assert.equal(buildNotifications([r], me, d.readNotificationIds)[0].unread, true);
  assert.equal((await post({ action: 'read-notification', id, commentId: first.id })).status, 200);
  await refresh();
  assert.ok(d.readNotificationIds.includes(notificationKey(id, first.id)));
  assert.equal(buildNotifications([r], me, d.readNotificationIds)[0].unread, false);
  assert.equal((await post({ action: 'read-notification', id, commentId: first.id })).status, 200);
  assert.equal(
    (
      await post({
        action: 'comment',
        id,
        version: r.version,
        text: 'Nouvelle mention',
        mentions: [me.email],
      })
    ).status,
    200,
  );
  await refresh();
  const second = r.comments.at(-1);
  assert.equal(
    buildNotifications([r], me, d.readNotificationIds).find((x) => x.id === second.id).unread,
    true,
  );
  assert.equal(
    (
      await post({
        action: 'comment',
        id,
        version: r.version,
        text: 'Troisième mention',
        mentions: [me.email],
      })
    ).status,
    200,
  );
  await refresh();
  const third = r.comments.at(-1);
  assert.equal(groupNotifications([r], me, d.readNotificationIds)[0].unreadCount, 1);
  const snapshot = [second.id, third.id];
  assert.equal(
    (
      await post({
        action: 'comment',
        id,
        version: r.version,
        text: 'Mention arrivée pendant le marquage',
        mentions: [me.email],
      })
    ).status,
    200,
  );
  await refresh();
  const fourth = r.comments.at(-1);
  assert.equal((await post({ action: 'read-notification', id, commentIds: snapshot })).status, 200);
  await refresh();
  let grouped = groupNotifications([r], me, d.readNotificationIds);
  assert.equal(grouped.length, 1);
  assert.deepEqual(grouped[0].unreadIds, [fourth.id]);
  assert.equal(
    (await post({ action: 'read-notification', id, commentIds: [fourth.id, 'introuvable'] }))
      .status,
    403,
  );
  await refresh();
  assert.deepEqual(groupNotifications([r], me, d.readNotificationIds)[0].unreadIds, [fourth.id]);
  assert.equal(
    (await post({ action: 'comment', id, version: r.version, text: 'Réponse', mentions: [] }))
      .status,
    200,
  );
  await refresh();
  assert.ok(buildNotifications([r], me, d.readNotificationIds).every((x) => !x.unread));
  assert.equal(
    (await post({ action: 'read-notification', id, commentId: r.comments.at(-1).id })).status,
    403,
  );
});
