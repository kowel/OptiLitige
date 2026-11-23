// Envoie dans OptiLitige les commentaires et pièces jointes exportés de SharePoint par
// scripts/sharepoint/export-commentaires-pj.js (dossier contenant reprise.json et pj/).
// Chaque élément SharePoint est rattaché au dossier importé qui porte le même ID.
// Relançable sans risque : ce qui a déjà été repris est ignoré.
//
//   pnpm run reprise-sharepoint -- --dossier "C:\…\export-sharepoint"
//   options : --site http://127.0.0.1:5173 (par défaut, base locale de test)
//             --cookie "CF_Authorization=…" (site en ligne, voir scripts/sharepoint/MODE-EMPLOI.md)
//             --liste "Dépot Litiges VPC" (sinon le nom indiqué dans reprise.json)
//             --essai (vérifie tout sans rien envoyer)
import fs from 'node:fs';
import path from 'node:path';
import { MAX_ATTACHMENT_BYTES } from '../app/attachment-rules.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback = '') => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const folder = opt('dossier');
const dryRun = args.includes('--essai');
if (!folder || !fs.existsSync(path.join(folder, 'reprise.json'))) {
  console.error('Indiquez le dossier exporté : --dossier "<dossier contenant reprise.json>"');
  process.exit(1);
}
const site = opt('site', 'http://127.0.0.1:5173').replace(/\/$/, '');
const exported = JSON.parse(fs.readFileSync(path.join(folder, 'reprise.json'), 'utf8'));
let list = opt('liste', exported.list);

// Session : simulée en local ; cookie Cloudflare Access pour le site en ligne
let cookie = opt('cookie');
if (!cookie) {
  const login = await fetch(site + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
}
const headers = { Cookie: cookie, Origin: site };

const data = await fetch(site + '/api/data', { headers }).then((r) => r.json());
if (data.error) {
  console.error('OptiLitige refuse la connexion : ' + data.error);
  process.exit(1);
}
if (data.me?.role !== 'Admin') {
  console.error('La reprise doit être faite avec un compte Admin.');
  process.exit(1);
}
// Le nom de la liste dans SharePoint peut différer du nom donné à l'import (nom du fichier
// exporté) : sans --liste, on prend alors la source importée qui a le plus de dossiers avec ID
if (!opt('liste') && !data.records.some((r) => r.sourceList === list && r.sourceId)) {
  const counts = {};
  for (const r of data.records)
    if (r.sourceId) counts[r.sourceList] = (counts[r.sourceList] || 0) + 1;
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best) {
    console.log('Liste SharePoint « ' + list + ' » rattachée à l’import « ' + best[0] + ' ».');
    list = best[0];
  }
}
// ID SharePoint → dossier OptiLitige
const byId = new Map(
  data.records
    .filter((r) => r.sourceList === list && r.sourceId)
    .map((r) => [String(r.sourceId), r]),
);
console.log(
  'Liste « ' +
    list +
    ' » : ' +
    byId.size +
    ' dossiers importés dans ' +
    site +
    (dryRun ? ' (essai)' : ''),
);

const report = {
  comments: 0,
  commentsUpdated: 0,
  commentsSkipped: 0,
  files: 0,
  filesSkipped: 0,
  missing: [],
  tooBig: [],
  errors: [],
};
for (const item of exported.items) {
  const record = byId.get(String(item.id));
  if (!record) {
    report.missing.push(item.id);
    continue;
  }
  if (item.comments.length) {
    if (dryRun) report.comments += item.comments.length;
    else {
      const res = await fetch(site + '/api/data', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import-comments', id: record.id, comments: item.comments }),
      });
      const d = await res.json();
      if (!res.ok) report.errors.push(record.ref + ' (commentaires) : ' + d.error);
      else {
        report.comments += d.added;
        report.commentsUpdated += d.updated || 0;
        report.commentsSkipped += d.skipped;
      }
    }
  }
  for (const a of item.attachments) {
    const file = path.join(folder, a.file);
    if (!fs.existsSync(file)) {
      report.errors.push(record.ref + ' : fichier absent ' + a.file);
      continue;
    }
    // Au-delà de la limite de l'outil (15 Mo) : signalé sans lire le fichier (vidéos de 95 Mo…)
    const size = fs.statSync(file).size;
    if (size > MAX_ATTACHMENT_BYTES) {
      report.tooBig.push(record.ref + ' · ' + a.name + ' (' + (size / 1048576).toFixed(0) + ' Mo)');
      continue;
    }
    if (dryRun) {
      report.files++;
      continue;
    }
    const body = new FormData();
    body.append('id', record.id);
    // Fichier lu au moment de l'envoi, sans tout charger en mémoire
    body.append('file', await fs.openAsBlob(file), a.name);
    body.append('sourceKey', 'sp-' + item.id + '/' + a.name);
    body.append('sourceAuthor', 'SharePoint');
    const res = await fetch(site + '/api/attachments', { method: 'POST', headers, body });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) report.errors.push(record.ref + ' · ' + a.name + ' : ' + (d.error || res.status));
    else if (d.skipped) report.filesSkipped++;
    else report.files++;
  }
}

console.log(
  (dryRun ? 'À reprendre : ' : 'Repris : ') +
    report.comments +
    ' commentaire(s), ' +
    report.files +
    ' pièce(s) jointe(s).' +
    (report.commentsUpdated ? ' Commentaires mis à jour : ' + report.commentsUpdated + '.' : '') +
    (report.commentsSkipped || report.filesSkipped
      ? ' Déjà présents : ' +
        report.commentsSkipped +
        ' commentaire(s), ' +
        report.filesSkipped +
        ' pièce(s) jointe(s).'
      : ''),
);
if (report.missing.length)
  console.log(
    report.missing.length +
      ' élément(s) SharePoint sans dossier dans OptiLitige (à importer d’abord) : ' +
      report.missing.slice(0, 20).join(', ') +
      (report.missing.length > 20 ? '…' : ''),
  );
if (report.tooBig.length) {
  console.log(
    report.tooBig.length +
      ' fichier(s) de plus de 15 Mo non repris (à compresser ou à déposer à la main) :',
  );
  for (const t of report.tooBig.slice(0, 50)) console.log(' - ' + t);
}
if (report.errors.length) {
  console.log(report.errors.length + ' problème(s) :');
  for (const e of report.errors.slice(0, 50)) console.log(' - ' + e);
}
if (exported.problems?.length)
  console.log(exported.problems.length + ' problème(s) signalé(s) pendant l’export SharePoint.');
