const word = /[\p{L}\p{M}\p{N}_]/u;
export const normalizeMention = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
export function findMentionQuery(text, caret, tokens = []) {
  if (!Number.isInteger(caret) || caret < 0 || caret > text.length) return null;
  const start = text.lastIndexOf('@', caret - 1);
  if (start < 0 || start >= caret) return null;
  if (start > 0 && !/[\s([{]/.test(text[start - 1])) return null;
  const query = text.slice(start + 1, caret);
  if (query.length > 80 || !/^([\p{L}\p{M}\p{N} ._'’\-]*)$/u.test(query)) return null;
  if (tokens.some((token) => token.start === start && caret >= token.end)) return null;
  return { start, end: caret, query };
}
export function filterMentionMembers(members, query, limit = 8) {
  const terms = normalizeMention(query).split(' ').filter(Boolean);
  const seen = new Set();
  return members
    .filter((member) => {
      if (member.role === 'Désactivé' || !member.email || seen.has(member.email)) return false;
      seen.add(member.email);
      const haystack = normalizeMention(member.name + ' ' + member.email);
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .slice(0, limit);
}
export function validMentionToken(text, token) {
  return (
    Number.isInteger(token.start) &&
    Number.isInteger(token.end) &&
    text.slice(token.start, token.end) === '@' + token.label &&
    (token.start === 0 || /[\s([{]/.test(text[token.start - 1])) &&
    (token.end === text.length || !word.test(text[token.end]))
  );
}
export function reconcileMentionTokens(before, after, tokens) {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix])
    prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++;
  const oldEnd = before.length - suffix,
    delta = after.length - before.length;
  return tokens.flatMap((token) => {
    let next;
    if (token.end <= prefix) next = token;
    else if (token.start >= oldEnd)
      next = { ...token, start: token.start + delta, end: token.end + delta };
    else return [];
    return validMentionToken(after, next) ? [next] : [];
  });
}
export function insertMention(text, query, member, tokens = []) {
  const value = '@' + member.name;
  const tail = text.slice(query.end),
    separator = !tail || !/^([\s,.;:!?\)\]])/.test(tail) ? ' ' : '';
  const next = text.slice(0, query.start) + value + separator + tail;
  const preserved = reconcileMentionTokens(text, next, tokens);
  return {
    text: next,
    caret: query.start + value.length + separator.length,
    tokens: [
      ...preserved,
      {
        start: query.start,
        end: query.start + value.length,
        email: member.email,
        label: member.name,
      },
    ].sort((a, b) => a.start - b.start),
  };
}
export function selectedMentionEmails(text, tokens, members) {
  const active = new Set(members.filter((m) => m.role !== 'Désactivé').map((m) => m.email));
  return [
    ...new Set(
      tokens.filter((t) => active.has(t.email) && validMentionToken(text, t)).map((t) => t.email),
    ),
  ];
}
