// Tests d'interface : un navigateur clique dans OptiLitige comme un agent (pnpm run test:ui).
// Ils utilisent Microsoft Edge déjà installé sur le poste (aucun navigateur à télécharger) et
// démarrent un site de test sur une copie de la base locale (scripts/serveur-tests.mjs).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/ui',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    // Copie de la base (scripts/serveur-tests.mjs) : la base de référence n'est jamais modifiée
    baseURL: 'http://127.0.0.1:5174',
    channel: process.env.PW_CHANNEL || 'msedge',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Caméra simulée (image de test) pour le test de la webcam : aucune vraie caméra nécessaire
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  outputDir: 'outputs/playwright',
  webServer: {
    command: 'node scripts/serveur-tests.mjs',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
