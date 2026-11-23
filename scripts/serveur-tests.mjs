// Serveur des tests automatiques (pnpm run test:api, pnpm run test:ui) : une COPIE de la base
// locale (.donnees-locales → .donnees-tests), sur http://127.0.0.1:5174. Les tests n'écrivent
// ainsi jamais dans la base de référence, même s'ils sont interrompus.
//
//   node scripts/serveur-tests.mjs           → copie fraîche de la base, puis serveur de test
//
// Les fichiers des pièces jointes ne sont pas copiés : les tests envoient les leurs.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

export const TEST_PORT = '5174';
export const TEST_ORIGIN = 'http://127.0.0.1:' + TEST_PORT;
const STATE = '.donnees-tests';

export function copierBase() {
  rmSync(STATE, { recursive: true, force: true });
  mkdirSync(STATE, { recursive: true });
  const base = join('.donnees-locales', 'base');
  if (existsSync(base)) cpSync(base, join(STATE, 'base'), { recursive: true });
}

export function demarrerServeurTests(stdio = 'inherit') {
  copierBase();
  return spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '-p', TEST_PORT, '-H', '127.0.0.1'],
    {
      stdio,
      env: {
        ...process.env,
        OPTILITIGE_ETAT: STATE,
        // Dossier de compilation à part : peut tourner à côté de « pnpm dev »
        NEXT_DIST_DIR: '.next-tests',
      },
    },
  );
}

// Lancé directement (Playwright) : le serveur reste au premier plan
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/serveur-tests.mjs')) {
  const child = demarrerServeurTests();
  child.on('exit', (code) => process.exit(code ?? 0));
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill());
}
