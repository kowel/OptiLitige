// Captures d'écran du guide de prise en main (pnpm run captures-guide).
// Ouvre le site local (pnpm dev doit tourner) avec Microsoft Edge et enregistre les écrans
// dans outputs/guide/. Les données sont celles de la démonstration et de la base de test locale.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
// THEME=dark pnpm run captures-guide → captures du mode sombre dans outputs/guide-dark/
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const OUT = THEME === 'dark' ? 'outputs/guide-dark' : 'outputs/guide';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL || 'msedge',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1.5,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  permissions: ['camera'],
});
// Thème imposé avant le chargement de chaque page
await context.addInitScript((t) => localStorage.setItem('optilitige-theme', t), THEME);
const page = await context.newPage();
const ready = () => page.locator('html[data-ready]').waitFor({ state: 'attached' });
const shot = async (name, target = page) => {
  await page.waitForTimeout(400);
  await target.screenshot({ path: `${OUT}/${name}.png` });
  console.log('✓ ' + name);
};
const view = (name) =>
  page.locator('.view-tabs').getByRole('button', { name, exact: true }).click();
const nav = (name) =>
  page.getByRole('button', { name, exact: false }).filter({ hasText: name }).first().click();

// --- Démonstration ---------------------------------------------------------------------
await page.goto(BASE + '/');
await ready();
await view('Relation client');
await shot('01-tableau-de-bord');

await page.locator('[aria-label="Notifications"]').click();
await shot('02-cloche', page.locator('.notifications'));
await page.locator('[aria-label="Notifications"]').click();

await page.getByRole('button', { name: 'Nouveau litige' }).first().click();
const form = page.locator('form').filter({ hasText: 'Référence commande' });
await form.getByLabel('Objet du litige *').fill('Écran fissuré à la réception');
await form.getByLabel('Numéro de compte client *').fill('C000123');
await form.getByLabel('Enseigne *').selectOption('MAGASIN');
await form.getByLabel('Magasin *').selectOption('NANTES');
await form.getByLabel('Référence commande *').fill('CMD-84752');
// Une pièce jointe choisie dès la création
await form.locator('input[type=file][multiple]').setInputFiles({
  name: 'Photo colis abîmé.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('ffd8ffe000104a464946', 'hex'),
});
await shot('03-nouveau-litige-doublon', page.locator('.modal').first());
await page.keyboard.press('Escape');
await page
  .locator('.modal [aria-label="Fermer"], .modal-close')
  .first()
  .click()
  .catch(() => {});

await nav('Dossiers litiges');
await page.locator('.period-picker select').first().selectOption('99999');
await page.getByRole('button', { name: /Plus de filtres/ }).click();
await page.locator('.advanced-filters').getByLabel('Montant mini (€)').fill('1000');
await shot(
  '04-liste-filtres',
  page.locator('section.panel').filter({ has: page.locator('.list-tools') }),
);
await page.getByRole('button', { name: /Effacer les filtres avancés/ }).click();
// Vue « Suivi de bout en bout » (côté client + côté transporteur)
await page.getByRole('button', { name: /Plus de filtres/ }).click(); // referme les filtres
await page.getByRole('button', { name: 'Suivi de bout en bout' }).click();
await page.locator('.tracking-table').evaluate((el) => {
  el.closest('.table-scroll').scrollLeft = 640;
});
await shot(
  '17-suivi-bout-en-bout',
  page.locator('.tracking-table').locator('xpath=ancestor::section[1]'),
);
await page.getByRole('button', { name: 'Liste', exact: true }).click();

await page.getByLabel('Rechercher un dossier').fill('Vitre du boîtier');
await page.locator('tbody tr').first().click();
await page.locator('.detail-heading').waitFor();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('05-fiche-dossier');

// Avoir : demande RC puis vue Service Litige
await page
  .locator('.detail-role-switcher')
  .getByRole('button', { name: 'Relation client', exact: true })
  .click();
await page
  .locator('.detail-tabs')
  .getByRole('button', { name: /^Avoirs/ })
  .click();
await page.getByRole('button', { name: 'Demander un avoir' }).click();
await page.locator('.credit-form').getByLabel('Montant demandé (€)').fill('89.90');
await page
  .locator('.credit-form')
  .getByLabel('Commentaire pour le service litige')
  .fill('Client mécontent, écran rayé à la livraison.');
await shot('06-demande-avoir', page.locator('.credit-panel'));
await page.locator('.credit-form').getByRole('button', { name: 'Envoyer la demande' }).click();
await page
  .locator('.detail-role-switcher')
  .getByRole('button', { name: 'Service Litige', exact: true })
  .click();
await page
  .locator('.detail-tabs')
  .getByRole('button', { name: /^Avoirs/ })
  .click();
// Laisser disparaître le message de confirmation
await page.waitForTimeout(5000);
await shot('07-avoir-a-traiter', page.locator('.credit-panel'));

// Traitement (Service Litige)
await shot('08-traitement', page.locator('.treatment').first());

// Analyses & statistiques (Admin)
// (le choix du service n'existe que sur la vue d'ensemble et la liste, en démonstration)
await nav('Vue d’ensemble');
await view('Admin');
await nav('Analyses & rapports');
await page
  .locator('.analytics-filter-bar select[aria-label="Période d’ouverture"]')
  .selectOption('99999');
const statsPanel = page.locator('.stats-panel:not(.outcome-panel)');
await statsPanel.scrollIntoViewIfNeeded();
await shot('09-statistiques', statsPanel);
await page.locator('.outcome-panel').scrollIntoViewIfNeeded();
await shot('16-resultats-litiges', page.locator('.outcome-panel'));

await nav('Paramètres');
await shot('10-delais-sla', page.locator('.sla-settings'));
await shot('11-reglages-avoirs', page.locator('.credit-settings'));
await shot('18-expeditions', page.locator('.shipment-settings'));

// Équipe (comptes fictifs) : un changement d'accès pour remplir le journal
await nav('Équipe & accès');
await page.getByRole('button', { name: 'Autoriser un agent' }).click();
const member = page.locator('.modal');
await member.getByLabel('Nom complet').fill('Julien Bernard');
await member.getByLabel('Adresse e-mail (compte Microsoft)').fill('julien.bernard@exemple.test');
await member.locator('select').selectOption('SAV');
await member.getByRole('button', { name: 'Enregistrer l’agent' }).click();
await page.waitForTimeout(5000);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('12-equipe-journal');

// --- Espace réel local (pièces jointes, webcam, équipe) --------------------------------
await page.goto(BASE + '/signin-with-chatgpt?return_to=/');
await ready();
await page.getByRole('button', { name: 'Accéder à mon espace réel' }).click();
await page.getByRole('button', { name: 'Revenir à la démonstration' }).waitFor();
await nav('Dossiers litiges');
await page.locator('.period-picker select').first().selectOption('99999');
await page.getByLabel('Rechercher un dossier').fill('Test UI pièce jointe');
await page.locator('tbody tr').first().click();
await page
  .locator('.detail-tabs')
  .getByRole('button', { name: /^Pièces jointes/ })
  .click();
await page.locator('.attachments').scrollIntoViewIfNeeded();
await shot('13-pieces-jointes', page.locator('.attachments'));
await page.getByRole('button', { name: 'Webcam' }).click();
const dialog = page.getByRole('dialog', { name: 'Photo depuis la webcam' });
await dialog.getByRole('button', { name: 'Prendre la photo' }).waitFor();
await page.waitForTimeout(1200);
await shot('14-webcam', dialog.locator('.webcam-box'));
await dialog.getByRole('button', { name: 'Annuler' }).click();

// --- Téléphone ------------------------------------------------------------------------
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  storageState: await context.storageState(),
});
await phone.addInitScript((t) => localStorage.setItem('optilitige-theme', t), THEME);
const m = await phone.newPage();
await m.goto(BASE + '/');
await m.locator('html[data-ready]').waitFor({ state: 'attached' });
await m.getByRole('button', { name: 'Accéder à mon espace réel' }).click();
await m.getByRole('button', { name: 'Revenir à la démonstration' }).waitFor();
await m.locator('nav button').nth(1).click();
await m.locator('.period-picker select').first().selectOption('99999');
await m.getByLabel('Rechercher un dossier').fill('Test UI pièce jointe');
await m.locator('tbody tr').first().click();
await m
  .locator('.detail-tabs')
  .getByRole('button', { name: /^Pièces jointes/ })
  .click();
// Bouton au milieu de l'écran, une fois le message « Espace de travail connecté » disparu
await m.waitForTimeout(5000);
await m
  .getByRole('button', { name: 'Prendre une photo' })
  .evaluate((el) => el.scrollIntoView({ block: 'center' }));
await m.waitForTimeout(400);
await m.screenshot({ path: `${OUT}/15-telephone.png` });
console.log('✓ 15-telephone');

await browser.close();
