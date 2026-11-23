// Texte lisible d'une ligne du journal des accès (« RC → Désactivé », « Ajouté : RC »…).
export function describeAccessChange(entry) {
  if (entry?.note) return entry.note;
  const before = entry?.before,
    after = entry?.after || {};
  if (!before) return 'Accès accordé : ' + after.role;
  const parts = [];
  if (before.role !== after.role)
    parts.push(
      after.role === 'Désactivé'
        ? 'Compte désactivé (était ' + before.role + ')'
        : before.role === 'Désactivé'
          ? 'Compte réactivé : ' + after.role
          : 'Service : ' + before.role + ' → ' + after.role,
    );
  if (before.name !== after.name) parts.push('Nom : ' + before.name + ' → ' + after.name);
  return parts.join(' · ') || 'Aucun changement';
}

// Ligne de journal créée en mode démonstration (le serveur fait la même chose en réel).
export function demoAccessEntry(me, previous, next) {
  return {
    date: new Date().toISOString(),
    by: me.email,
    byName: me.name,
    email: next.email,
    before: previous ? { name: previous.name, role: previous.role } : null,
    after: { name: next.name, role: next.role },
  };
}
