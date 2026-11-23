export const notificationKey = (recordId, commentId) => recordId + ':' + commentId;
export function buildNotifications(records, me, readKeys = []) {
  const read = new Set(readKeys);
  const result = [];
  for (const record of records) {
    const comments = record.comments || [];
    let lastReply = -1;
    for (let i = 0; i < comments.length; i++) if (comments[i].email === me.email) lastReply = i;
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      if (!comment.mentions?.includes(me.email)) continue;
      const key = notificationKey(record.id, comment.id);
      result.push({ ...comment, record, key, unread: !read.has(key) && lastReply <= i });
    }
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

export function groupNotifications(records, me, readKeys = []) {
  const grouped = new Map();
  for (const item of buildNotifications(records, me, readKeys)) {
    const list = grouped.get(item.record.id) || [];
    list.push(item);
    grouped.set(item.record.id, list);
  }
  return [...grouped.values()]
    .map((items) => {
      const pending = items.filter((item) => item.unread);
      const candidates = pending.length ? pending : items;
      const latest = [...candidates].sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.record.comments.findIndex((c) => c.id === b.id) -
            a.record.comments.findIndex((c) => c.id === a.id),
      )[0];
      return {
        ...latest,
        key: latest.record.id,
        unread: pending.length > 0,
        unreadIds: pending.map((item) => item.id),
        unreadCount: pending.length,
        mentionCount: pending.length || items.length,
        totalMentionCount: items.length,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
