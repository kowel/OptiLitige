// Pré-remplissage du traitement d'après les échanges : applique un fichier de propositions
// (une valeur et sa source par champ, voir work/preremplissage/) à la base, par l'API.
// Seuls les champs vides sont remplis ; chaque dossier garde la liste « à vérifier ».
//
//   node scripts/preremplir.mjs work/preremplissage/ouverts-2026-11-12.json
//   node scripts/preremplir.mjs <fichier> --site https://litiges.cybertek.fr --cookie "CF_Authorization=…"
//   node scripts/preremplir.mjs <fichier> --essai      (montre ce qui serait fait, sans rien écrire)
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
const file = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
if (!file) {
  console.error('Indiquez le fichier de propositions (.json).');
  process.exit(1);
}
const dryRun = args.includes('--essai');
const site = (opt('site') || 'http://127.0.0.1:5173').replace(/\/$/, '');
let cookie = opt('cookie');
if (!cookie) {
  const login = await fetch(site + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
}
const headers = { Cookie: cookie, Origin: site, 'Content-Type': 'application/json' };
const data = await fetch(site + '/api/data', { headers }).then((r) => r.json());
if (!data.records) {
  console.error('Connexion impossible :', data.error || 'réponse inattendue');
  process.exit(1);
}
const byRef = new Map(data.records.map((r) => [r.ref, r]));
const { dossiers } = JSON.parse(fs.readFileSync(file, 'utf8'));
let filled = 0,
  fields = 0;
for (const d of dossiers) {
  const record = byRef.get(d.ref);
  if (!record) {
    console.log('✗', d.ref, ': dossier introuvable');
    continue;
  }
  if (dryRun) {
    console.log('·', d.ref, Object.keys(d.fields).join(', '));
    continue;
  }
  const res = await fetch(site + '/api/data', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'prefill',
      id: record.id,
      fields: d.fields,
      sources: d.sources,
    }),
  });
  const out = await res.json();
  if (!res.ok) {
    console.log('✗', d.ref, ':', out.error);
    continue;
  }
  if (out.applied.length) filled++;
  fields += out.applied.length;
  const skipped = out.skipped.map((s) => s.field + ' (' + s.reason + ')').join(', ');
  console.log(
    '✓',
    d.ref,
    ':',
    out.applied.length,
    'champ(s)',
    skipped ? '· ignorés : ' + skipped : '',
  );
}
if (!dryRun)
  console.log('\n' + filled + ' dossier(s) pré-rempli(s), ' + fields + ' champ(s) au total.');
