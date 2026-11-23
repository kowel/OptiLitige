// Parcours dans l'espace réel LOCAL (base de test de pnpm dev, connexion simulée « Seedy »).
import { test, expect } from '@playwright/test';

async function signIn(page) {
  await page.goto('/signin-with-chatgpt?return_to=/');
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Accéder à mon espace réel' }).click();
  await expect(page.getByRole('button', { name: 'Revenir à la démonstration' })).toBeVisible();
}

test('Créer un dossier, ajouter une pièce jointe, la retrouver dans l’historique et la fiche PDF', async ({
  page,
}) => {
  await signIn(page);
  const order = 'UI-' + Date.now();
  await page.getByRole('button', { name: 'Nouveau litige' }).first().click();
  const form = page.locator('form').filter({ hasText: 'Référence commande' });
  await form.getByLabel('Objet du litige *').fill('Test UI pièce jointe');
  await form.getByLabel('Numéro de compte client *').fill('C000123');
  await form.getByLabel('Référence commande *').fill(order);
  await form.getByLabel('Montant concerné par le litige (€) *').fill('120');
  await form.getByLabel('Description et éléments du client *').fill('Test automatique.');
  // Photo jointe dès la création : envoyée juste après la création du dossier
  await form.locator('input[type=file][multiple]').setInputFiles({
    name: 'Photo colis.png',
    mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
  });
  await form.getByRole('button', { name: /Créer/ }).click();
  await expect(page.getByText('Dossier créé avec 1 pièce jointe').first()).toBeVisible();

  await page.getByLabel('Rechercher un dossier').fill(order);
  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('heading', { name: 'Test UI pièce jointe' })).toBeVisible();
  await expect(page.locator('.participants')).toContainText('Propriétaire');

  await page
    .locator('.detail-tabs')
    .getByRole('button', { name: /^Pièces jointes/ })
    .click();
  await page.locator('.attachments input[type=file]:not([capture])').setInputFiles({
    name: 'Bon de livraison.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  await expect(page.locator('.attachment-list')).toContainText('Bon de livraison.pdf');
  await expect(page.locator('.attachment-list')).toContainText('Photo colis.png');
  // Un format refusé affiche un message clair
  await page
    .locator('.attachments input[type=file]:not([capture])')
    .setInputFiles({ name: 'piege.html', mimeType: 'text/html', buffer: Buffer.from('<b>x</b>') });
  await expect(page.locator('.attachments .error')).toContainText('Format non accepté');

  await page.locator('.detail-tabs').getByRole('button', { name: 'Historique' }).click();
  await expect(page.locator('.timeline')).toContainText(
    'Pièce jointe ajoutée : Bon de livraison.pdf',
  );
  // La fiche PDF contient la pièce jointe
  await expect(page.locator('.print-sheet')).toContainText('Bon de livraison.pdf');
});

test.describe('Téléphone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test('Sur téléphone : pas de débordement et bouton « Prendre une photo »', async ({ page }) => {
    await signIn(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.locator('nav button').nth(1).click(); // Dossiers litiges
    await page.locator('.period-picker select').first().selectOption('99999');
    await page.locator('tbody tr').first().click();
    await page
      .locator('.detail-tabs')
      .getByRole('button', { name: /^Pièces jointes/ })
      .click();
    await expect(page.getByRole('button', { name: 'Prendre une photo' })).toBeVisible();
  });
});

test.describe('Webcam sur ordinateur', () => {
  // Caméra simulée par le navigateur (voir playwright.config.mjs) ; autorisation accordée d'office
  test.use({ permissions: ['camera'] });
  test('Prendre une photo avec la webcam et l’ajouter au dossier', async ({ page }) => {
    await signIn(page);
    await page.locator('nav button').nth(1).click(); // Dossiers litiges
    await page.locator('.period-picker select').first().selectOption('99999');
    await page.getByLabel('Rechercher un dossier').fill('Test UI pièce jointe');
    await page.locator('tbody tr').first().click();
    await page
      .locator('.detail-tabs')
      .getByRole('button', { name: /^Pièces jointes/ })
      .click();
    const before = await page.locator('.attachment-list li').count();
    await page.getByRole('button', { name: 'Webcam' }).click();
    const dialog = page.getByRole('dialog', { name: 'Photo depuis la webcam' });
    await expect(dialog.getByRole('button', { name: 'Prendre la photo' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Prendre la photo' }).click();
    await expect(dialog.getByAltText('Photo prise')).toBeVisible();
    await dialog.getByRole('button', { name: 'Ajouter au dossier' }).click();
    await expect(dialog).toContainText('1 photo(s) ajoutée(s) au dossier');
    await dialog.getByRole('button', { name: 'Terminer' }).click();
    await expect(page.locator('.attachment-list li')).toHaveCount(before + 1);
    await expect(page.locator('.attachment-list')).toContainText(/Photo LIT-.*\.jpg/);
  });
});

test('Déconnexion automatique après 2 heures sans action, avec préavis', async ({ page }) => {
  await page.clock.install();
  await signIn(page);
  // 1 h 59 min 30 s sans action : préavis
  await page.clock.fastForward('01:59:30');
  const dialog = page.getByRole('alertdialog', { name: 'Déconnexion imminente' });
  await expect(dialog).toBeVisible();
  // « Rester connecté » repart pour 2 heures
  await dialog.getByRole('button', { name: 'Rester connecté' }).click();
  await expect(dialog).toHaveCount(0);
  await page.clock.fastForward('01:00:00');
  await expect(dialog).toHaveCount(0);
  // Puis 2 heures sans action : déconnexion
  await page.clock.fastForward('01:00:30');
  await page.waitForURL(/signout|\/$/);
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  const status = await page.evaluate(() => fetch('/api/data').then((r) => r.status));
  expect(status).toBe(401);
});

test('Échanges en direct : un commentaire écrit dans un onglet apparaît dans l’autre sans recharger', async ({
  page,
  context,
}) => {
  await signIn(page);
  const order = 'UI-' + Date.now();
  await page.getByRole('button', { name: 'Nouveau litige' }).first().click();
  const form = page.locator('form').filter({ hasText: 'Référence commande' });
  await form.getByLabel('Objet du litige *').fill('Test UI direct');
  await form.getByLabel('Numéro de compte client *').fill('C000123');
  await form.getByLabel('Référence commande *').fill(order);
  await form.getByLabel('Montant concerné par le litige (€) *').fill('50');
  await form.getByLabel('Description et éléments du client *').fill('Test automatique.');
  await form.getByRole('button', { name: /Créer/ }).click();
  await expect(page.getByText('Dossier créé').first()).toBeVisible();
  const openIt = async (p) => {
    await p.getByRole('button', { name: /Dossiers litiges/ }).click();
    await p.getByLabel('Rechercher un dossier').fill(order);
    await p.locator('tbody tr').first().click();
    await expect(p.getByRole('heading', { name: 'Test UI direct' })).toBeVisible();
  };
  await openIt(page);

  // Deuxième onglet : même dossier, on y écrit un commentaire
  const other = await context.newPage();
  await signIn(other);
  await openIt(other);
  await other
    .getByPlaceholder(/Écrivez votre commentaire/)
    .fill('Message écrit dans l’autre onglet');
  await other.getByRole('button', { name: 'Envoyer' }).click();
  await expect(other.locator('.comments')).toContainText('Message écrit dans l’autre onglet');

  // Le premier onglet l'affiche sans rechargement, et le message en cours d'écriture est gardé
  await page.getByPlaceholder(/Écrivez votre commentaire/).fill('Brouillon en cours');
  await expect(page.locator('.comments')).toContainText('Message écrit dans l’autre onglet', {
    timeout: 8000,
  });
  await expect(page.getByPlaceholder(/Écrivez votre commentaire/)).toHaveValue(
    'Brouillon en cours',
  );
});

test('Échanges en direct entre deux postes (deux sessions séparées)', async ({ page, browser }) => {
  await signIn(page);
  const order = 'UI-' + Date.now();
  await page.getByRole('button', { name: 'Nouveau litige' }).first().click();
  const form = page.locator('form').filter({ hasText: 'Référence commande' });
  await form.getByLabel('Objet du litige *').fill('Test UI deux postes');
  await form.getByLabel('Numéro de compte client *').fill('C000123');
  await form.getByLabel('Référence commande *').fill(order);
  await form.getByLabel('Montant concerné par le litige (€) *').fill('50');
  await form.getByLabel('Description et éléments du client *').fill('Test automatique.');
  await form.getByRole('button', { name: /Créer/ }).click();
  await expect(page.getByText('Dossier créé').first()).toBeVisible();
  const openIt = async (p) => {
    await p.getByRole('button', { name: /Dossiers litiges/ }).click();
    await p.getByLabel('Rechercher un dossier').fill(order);
    await p.locator('tbody tr').first().click();
    await expect(p.getByRole('heading', { name: 'Test UI deux postes' })).toBeVisible();
  };
  await openIt(page);
  // Autre poste : autre session de navigateur (pas de partage entre onglets possible)
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await signIn(other);
  await openIt(other);
  await other.getByPlaceholder(/Écrivez votre commentaire/).fill('Message depuis un autre poste');
  await other.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.comments')).toContainText('Message depuis un autre poste', {
    timeout: 10000,
  });
  await ctx.close();
});

test('Traitement : plusieurs enregistrements de suite sans quitter le dossier', async ({
  page,
}) => {
  await signIn(page);
  const order = 'UI-SAVE-' + Date.now();
  await page.getByRole('button', { name: 'Nouveau litige' }).first().click();
  const form = page.locator('form').filter({ hasText: 'Référence commande' });
  await form.getByLabel('Objet du litige *').fill('Test UI double enregistrement');
  await form.getByLabel('Numéro de compte client *').fill('C000123');
  await form.getByLabel('Référence commande *').fill(order);
  await form.getByLabel('Montant concerné par le litige (€) *').fill('80');
  await form.getByLabel('Description et éléments du client *').fill('Test automatique.');
  await form.getByRole('button', { name: /Créer/ }).click();
  await page.getByLabel('Rechercher un dossier').fill(order);
  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('heading', { name: 'Test UI double enregistrement' })).toBeVisible();
  const treatment = page.locator('.treatment');
  const save = treatment.getByRole('button', { name: 'Enregistrer le traitement' });
  // 1er enregistrement : prise en charge
  await treatment.getByLabel('Statut du dossier').selectOption('Pris en charge');
  await save.click();
  await expect(page.locator('.timeline, .detail-info').first()).toBeVisible();
  await expect(save).toBeEnabled();
  // 2e et 3e enregistrements, sans quitter le dossier
  for (const ref of ['REC-1', 'REC-2']) {
    await treatment.getByLabel('Référence de réclamation transporteur').fill(ref);
    await save.click();
    await expect(save).toBeEnabled();
    await expect(page.getByText('Un autre agent a modifié ce dossier')).toHaveCount(0);
  }
  await page.locator('.detail-tabs').getByRole('button', { name: 'Historique' }).click();
  await expect(page.locator('.timeline')).toContainText('Nouveau → Pris en charge');
  await expect(
    page.locator('.timeline li, .timeline > *').filter({ hasText: 'Informations mises à jour' }),
  ).toHaveCount(2);
});

test('Contentieux : ajouter une pièce jointe à la fiche, la retrouver puis la supprimer', async ({
  page,
}) => {
  await signIn(page);
  const order = 'UI-CT-' + Date.now();
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /^Contentieux/ })
    .click();
  await page.getByRole('button', { name: 'Nouveau contentieux' }).click();
  const form = page.locator('form').filter({ hasText: 'Type de contentieux' });
  await expect(form.locator('.ct-attachments')).toContainText('Enregistrez d’abord le contentieux');
  await form.getByLabel('Date de réception').fill('2026-11-10');
  await form.getByLabel('Type de contentieux').selectOption('Médiation');
  await form.getByLabel('Client (n° de compte)').fill('C-UI-CT');
  await form.getByLabel('N° de commande').fill(order);
  await form.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('.ct-table tbody tr').filter({ hasText: order }).first().click();
  const box = page.locator('.ct-attachments');
  await box.locator('input[type=file][multiple]').setInputFiles({
    name: 'Courrier recommandé.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  await expect(box.getByRole('link', { name: 'Courrier recommandé.pdf' })).toBeVisible();
  await expect(box).toContainText('Pièces jointes (1)');
  if (process.env.CAPTURE_CT_PJ) await box.screenshot({ path: process.env.CAPTURE_CT_PJ });
  // Le contentieux s'enregistre toujours après l'ajout, et garde sa pièce jointe
  const sheet = page.getByRole('dialog', { name: /^Contentieux CT-/ });
  await sheet.getByLabel(/^Statut/).selectOption('Répondu');
  await sheet.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('.ct-table tbody tr').filter({ hasText: order }).first().click();
  await expect(box.getByRole('link', { name: 'Courrier recommandé.pdf' })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await box.getByRole('button', { name: 'Supprimer Courrier recommandé.pdf' }).click();
  await expect(box).toContainText('Aucune pièce jointe pour ce contentieux.');
});
