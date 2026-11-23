// Propriétaire et intervenants d'un dossier.
// Le propriétaire est l'agent qui a créé le dossier (généralement RC ou SAV). Les intervenants
// sont toutes les autres personnes qui ont agi sur le dossier : commentaires, échanges
// transporteur, pièces jointes, avoirs, changements de statut…

const norm = (v) =>
  String(v || '')
    .trim()
    .toLowerCase();

export function participants(record, members = []) {
  const byEmail = new Map(members.map((m) => [norm(m.email), m]));
  const byName = new Map(members.map((m) => [norm(m.name), m]));
  const people = new Map(); // clé : e-mail si connu, sinon nom

  const add = (email, name, what) => {
    const m = byEmail.get(norm(email)) || byName.get(norm(name));
    const label = m?.name || name || email;
    if (!label || label === 'Migration' || label === 'Historique importé') return;
    const key = m ? norm(m.email) : norm(email) || norm(name);
    const p = people.get(key) || { key, name: label, role: m?.role || '', actions: new Set() };
    if (what) p.actions.add(what);
    people.set(key, p);
  };

  const owner = byEmail.get(norm(record?.creator));
  for (const c of record?.comments || []) add(c.email, c.author, 'messages');
  for (const t of record?.transportMessages || []) add('', t.author, 'transporteur');
  for (const a of record?.attachments || []) add(a.email, a.author, 'pièces jointes');
  for (const c of record?.credits || []) {
    add(c.requestedBy, c.requestedByName, 'avoirs');
    for (const step of [c.review, c.decision, c.issue])
      if (step) add(step.by, step.byName, 'avoirs');
  }
  for (const h of record?.history || []) add('', h.author, '');

  const ownerKey = norm(record?.creator);
  const others = [...people.values()]
    .filter((p) => p.key !== ownerKey && norm(p.name) !== norm(owner?.name))
    .map((p) => ({ ...p, actions: [...p.actions] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    owner: owner
      ? { name: owner.name, role: owner.role, email: owner.email }
      : record?.creator
        ? { name: record.creator, role: '', email: record.creator }
        : null,
    others,
  };
}
