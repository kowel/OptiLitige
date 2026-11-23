// Format commun des dates avec heure, toujours à l'heure de Paris : « 06/11/2026 à 13:34 ».
export function dateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(+d)) return '—';
  const day = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const time = d.toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  });
  return day + ' à ' + time;
}

// Date et fichier d'import d'un dossier. Les dossiers importés avant l'ajout du champ
// `importedAt` sont retrouvés grâce à leur ligne d'historique « Import depuis … ».
export function importInfo(record) {
  if (record?.importedAt) return { date: record.importedAt, file: record.importFile || '' };
  const line = (record?.history || []).find((h) => /^Import depuis /.test(String(h.text)));
  if (!line) return null;
  const file = String(line.text)
    .replace(/^Import depuis /, '')
    .replace(/ · statut repris : .*$/, '');
  return { date: line.date, file };
}
