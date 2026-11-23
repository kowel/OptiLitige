// pnpm run test:api : tests de l'API sur une COPIE de la base locale (scripts/serveur-tests.mjs,
// http://127.0.0.1:5174), démarrée pour l'occasion puis arrêtée. La base de référence
// (.donnees-locales) n’est jamais modifiée, même si les tests échouent ou sont interrompus.
import { spawnSync } from 'node:child_process';
import { demarrerServeurTests, TEST_ORIGIN } from './serveur-tests.mjs';

const server = demarrerServeurTests('ignore');
const stop = () => {
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill();
};
process.on('SIGINT', () => {
  stop();
  process.exit(1);
});

// Attente du serveur (première compilation : jusqu'à 3 minutes)
let ready = false;
for (let i = 0; i < 180 && !ready; i++) {
  try {
    ready = (await fetch(TEST_ORIGIN + '/')).status < 500;
  } catch {
    // serveur pas encore prêt
  }
  if (!ready) await new Promise((r) => setTimeout(r, 1000));
}
if (!ready) {
  stop();
  console.error('Le serveur de test ne démarre pas (' + TEST_ORIGIN + ').');
  process.exit(1);
}
const run = spawnSync(
  process.execPath,
  ['--test', 'tests/api-local.test.mjs', 'tests/notifications-api-local.test.mjs'],
  { stdio: 'inherit', env: { ...process.env, TEST_ORIGIN } },
);
stop();
process.exit(run.status ?? 1);
