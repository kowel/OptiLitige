// Parcours d'agents en mode démonstration (données fictives, enregistrées dans le navigateur
// du test uniquement).
import { test, expect } from '@playwright/test';

// Ouvre le site sur une démonstration vierge
async function start(page) {
  await page.goto('/');
  await expect(page.getByText('Mode démonstration')).toBeVisible();
  // Attendre que la page réagisse aux clics
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
}
const view = (page, name) => page.locator('.view-tabs').getByRole('button', { name, exact: true });

test('La RC crée un litige ; l’alerte doublon apparaît pour une commande existante', async ({
  page,
}) => {
  await start(page);
  await view(page, 'Relation client').click();
  await page.getByRole('button', { name: 'Nouveau litige' }).first().click();
  const form = page.locator('form').filter({ hasText: 'Référence commande' });
  await form.getByLabel('Objet du litige *').fill('Test UI : écran fissuré');
  await form.getByLabel('Numéro de compte client *').fill('C000123');
  // Commande déjà utilisée par un dossier de démonstration → alerte doublon
  await form.getByLabel('Référence commande *').fill('cmd 84752');
  await expect(page.getByText('Un litige existe déjà pour cette commande')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Créer quand même' })).toBeVisible();
  // Nouvelle commande : plus d'alerte
  await form.getByLabel('Référence commande *').fill('CMD-UI-0001');
  await expect(page.getByText('Un litige existe déjà pour cette commande')).toHaveCount(0);
  await form.getByLabel('Montant concerné par le litige (€) *').fill('349.90');
  await form.getByLabel('Description et éléments du client *').fill('Écran reçu fissuré.');
  // Enseigne « MAGASIN » : le choix du magasin apparaît et devient obligatoire
  await expect(form.getByLabel('Magasin *')).toHaveCount(0);
  await form.getByLabel('Enseigne *').selectOption('MAGASIN');
  await expect(form.getByLabel('Magasin *')).toHaveAttribute('required', '');
  await form.getByLabel('Magasin *').selectOption('NANTES');
  // Demandeur obligatoire, l'agent connecté par défaut
  await expect(form.getByLabel('Demandeur *')).toHaveAttribute('required', '');
  await expect(form.getByLabel('Demandeur *').locator('option:checked')).toContainText('(vous)');
  // Pièces jointes dès la création
  await form.locator('input[type=file][multiple]').setInputFiles({
    name: 'bon-de-livraison.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  await expect(form.locator('.attachment-list')).toContainText('bon-de-livraison.pdf');
  await form.getByRole('button', { name: 'Créer et transmettre' }).click();
  await expect(page.getByText('Dossier créé et transmis').first()).toBeVisible();
  // Le dossier est dans la liste et la recherche le retrouve par n° de commande
  await page.getByLabel('Rechercher un dossier').fill('CMD-UI-0001');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Test UI : écran fissuré');
});

test('Circuit d’un avoir : demande RC, acceptation et émission par le service litige', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('tbody tr').first().click();
  const role = (name) =>
    page.locator('.detail-role-switcher').getByRole('button', { name, exact: true }).click();
  const avoirs = () =>
    page
      .locator('.detail-tabs')
      .getByRole('button', { name: /^Avoirs/ })
      .click();

  await role('Relation client');
  await avoirs();
  await page.getByRole('button', { name: 'Demander un avoir' }).click();
  const form = page.locator('.credit-form');
  await form.getByLabel('Famille de motif').selectOption('commercial');
  await form.getByLabel('Montant demandé (€)').fill('200');
  // Aucune validation par un responsable, quel que soit le montant
  await expect(form.getByText('un responsable doit valider')).toHaveCount(0);
  await form.getByRole('button', { name: 'Envoyer la demande' }).click();
  const card = page.locator('.credit-card').first();
  await expect(card).toContainText('Demandé');

  // Le service litige accepte puis enregistre l'avoir fait dans l'ERP
  await role('Service Litige');
  await avoirs();
  await card.getByRole('button', { name: 'Accepter' }).click();
  await expect(card).toContainText('Accepté');
  await card.getByLabel('N° d’avoir (ERP)').fill('AV-UI-0001');
  await card.getByRole('button', { name: 'Enregistrer l’avoir émis' }).click();
  await expect(card).toContainText('Émis');
  await expect(card).toContainText('AV-UI-0001');
  // Résumé dans le traitement (partie 4), avec le numéro de l'ERP
  await expect(page.locator('.treatment .credit-summary')).toContainText('n° AV-UI-0001');
  // Tracé dans l'historique
  await page.locator('.detail-tabs').getByRole('button', { name: 'Historique' }).click();
  await expect(page.locator('.timeline')).toContainText('Avoir émis dans l’ERP : n° AV-UI-0001');
});

test('Filtres avancés et vue partagée par service', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('.period-picker select').first().selectOption('99999');
  const rows = page.locator('tbody tr');
  const total = await rows.count();
  await page.getByRole('button', { name: /Plus de filtres/ }).click();
  await page.locator('.advanced-filters').getByLabel('Montant mini (€)').fill('1000');
  await expect(rows).not.toHaveCount(total);
  const filtered = await rows.count();

  await view(page, 'Relation client').click();
  await page.getByRole('button', { name: /Enregistrer cette vue/ }).click();
  await page.getByPlaceholder('Nom de la vue').fill('UI gros montants');
  await page.locator('.list-tools-save').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByLabel('Mes vues')).toContainText('UI gros montants');

  // Invisible pour le service litige
  await view(page, 'Service Litige').click();
  await expect(page.getByLabel('Mes vues')).not.toContainText('UI gros montants');

  // De retour en RC : la vue réapplique les filtres
  await view(page, 'Relation client').click();
  await page.getByRole('button', { name: /Effacer les filtres avancés/ }).click();
  await expect(rows).toHaveCount(total);
  await page.getByLabel('Mes vues').selectOption({ label: 'UI gros montants' });
  await expect(rows).toHaveCount(filtered);
});

test('Période personnalisée dans Analyses litiges', async ({ page }) => {
  await start(page);
  await view(page, 'Service Litige').click();
  await page.getByRole('button', { name: 'Analyses litiges' }).click();
  const filter = page.locator('.analytics-filter-bar');
  await filter.getByLabel('Période d’ouverture').selectOption('custom');
  await expect(filter.getByLabel('Date de début')).toBeVisible();
  await filter.getByLabel('Date de début').fill('2020-01-01');
  await filter.getByLabel('Date de fin').fill('2020-01-02');
  await expect(page.locator('.analytics-summary strong').first()).toHaveText('0');
  await expect(page.locator('.stats-panel:not(.outcome-panel)')).toContainText(
    'du 01/01/2020 au 02/01/2020',
  );
});

test('Analyses : les filtres enseigne et transporteur adaptent tout l’écran', async ({ page }) => {
  await start(page);
  await view(page, 'Service Litige').click();
  await page.getByRole('button', { name: 'Analyses litiges' }).click();
  const bar = page.locator('.analytics-filter-bar');
  await bar.getByLabel('Période d’ouverture').selectOption('99999');
  const total = Number(await page.locator('.analytics-summary strong').first().textContent());
  expect(total).toBeGreaterThan(1);
  const carrier = bar.getByLabel('Transporteur');
  const first = await carrier.locator('option').nth(1).getAttribute('value');
  await carrier.selectOption(first);
  await expect(bar).toContainText('1 filtre(s) actif(s)');
  const byCarrier = Number(await page.locator('.analytics-summary strong').first().textContent());
  expect(byCarrier).toBeLessThan(total);
  await expect(bar.locator('.afb-count b')).toHaveText(String(byCarrier));
  await bar.getByLabel('Enseigne').selectOption({ index: 1 });
  await expect(bar).toContainText('2 filtre(s) actif(s)');
  await bar.getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(page.locator('.analytics-summary strong').first()).toHaveText(String(total));
});

test('Apparence : mode clair / sombre et couleurs au choix, retenus au rechargement', async ({
  page,
}) => {
  await start(page);
  const html = page.locator('html');
  const menu = page.locator('.appearance-menu');
  const open = () => page.locator('.theme-toggle').click();
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await open();
  await menu.getByRole('radio', { name: 'Clair' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await menu.getByRole('radio', { name: 'Sombre' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  // Sombre par défaut : Minuit (bleu nuit profond)
  await expect(html).not.toHaveAttribute('data-dark', /./);
  const minuit = await bg();
  expect(minuit).not.toBe('rgb(248, 249, 252)');
  // Graphite : autre fond, gris presque neutre
  await menu.getByRole('radio', { name: /Graphite/ }).click();
  await expect(html).toHaveAttribute('data-dark', 'graphite');
  await expect.poll(bg).not.toBe(minuit);
  // Clair Ardoise
  await menu.getByRole('radio', { name: /Ardoise/ }).click();
  await menu.getByRole('radio', { name: 'Clair' }).click();
  await expect(html).toHaveAttribute('data-light', 'ardoise');
  await expect(html).toHaveAttribute('data-theme', 'light');
  // Retenus au rechargement, appliqués avant l'affichage
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(html).toHaveAttribute('data-light', 'ardoise');
  await expect(html).toHaveAttribute('data-dark', 'graphite');
  // Retour aux réglages d'origine (le navigateur de test est en clair)
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await open();
  await menu.getByRole('radio', { name: /Violet/ }).click();
  await menu.getByRole('radio', { name: /Minuit/ }).click();
  await menu.getByRole('radio', { name: 'Auto' }).click();
  await expect(html).not.toHaveAttribute('data-light', /./);
  await expect(html).not.toHaveAttribute('data-dark', /./);
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('Paramètres réservés aux responsables ; service affiché à côté du nom', async ({ page }) => {
  await start(page);
  await view(page, 'Relation client').click();
  await expect(page.locator('.top-user')).toContainText('Relation client');
  await expect(page.getByRole('button', { name: 'Paramètres' })).toHaveCount(0);
  await view(page, 'Admin').click();
  await expect(page.locator('.top-user')).toContainText('Admin');
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await expect(page.getByRole('heading', { name: 'Types de litiges' })).toBeVisible();
  // Plus de choix du service en haut des paramètres
  await expect(page.locator('.view-tabs')).toHaveCount(0);
});

test('Analyses : résultats des litiges (fraudes, requalifications)', async ({ page }) => {
  await start(page);
  await view(page, 'Service Litige').click();
  await page.getByRole('button', { name: 'Analyses litiges' }).click();
  const panel = page.locator('.outcome-panel');
  await expect(panel).toContainText('Résultats des litiges');
  await expect(panel).toContainText('Fraudes');
  await expect(panel).toContainText('Requalifiés à la clôture');
});

test('Guide de prise en main : lien vers le guide complet', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: /Guide de prise en main/ }).click();
  await expect(page.getByRole('link', { name: /Ouvrir le guide complet/ })).toHaveAttribute(
    'href',
    /^https:\/\/claude\.ai\/artifact\//,
  );
});

test('Suivi de bout en bout, décision transporteur et expéditions', async ({ page }) => {
  await start(page);
  await view(page, 'Admin').click();
  await expect(page.locator('.top-user')).toContainText('Admin');
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('.period-picker select').first().selectOption('99999');
  await page.getByRole('button', { name: 'Suivi de bout en bout' }).click();
  const table = page.locator('.tracking-table');
  await expect(table.locator('th').first()).toHaveText('N° de commande');
  await expect(table).toContainText('Statut transporteur');
  await expect(table.locator('.track-pill.ok').first()).toBeVisible();
  // Export avec les colonnes du suivi
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter' }).click();
  expect((await download).suggestedFilename()).toBe('optilitige-suivi-bout-en-bout.csv');

  // Responsable : décision du transporteur dans le traitement
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await page.locator('tbody tr').filter({ hasText: 'Transport' }).first().click();
  await page.getByLabel('Décision du transporteur').selectOption('Refusé');
  await page.getByRole('button', { name: 'Enregistrer le traitement' }).click();
  await expect(page.getByText('Modifications enregistrées').first()).toBeVisible();

  // Statistiques : ratio litiges / expéditions (expéditions de démonstration)
  await page.getByRole('button', { name: 'Analyses litiges' }).click();
  const stats = page.locator('.stats-panel:not(.outcome-panel)');
  await expect(stats).toContainText('Litiges / expéditions (%)');
  await expect(stats).toContainText('Refusés par le transporteur (%)');

  // Paramètres → Expéditions : saisie manuelle
  await page.getByRole('button', { name: 'Paramètres' }).click();
  const shipments = page.locator('.shipment-settings');
  await expect(shipments).toContainText('Connexion à l’outil d’expédition à finaliser');
  await shipments.locator('input').first().fill('4321');
  await shipments.getByRole('button', { name: 'Enregistrer les expéditions' }).click();
  await expect(page.locator('.shipment-settings')).toContainText('Saisie manuelle');
});

test('Tri des dossiers par date de déclaration', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('.period-picker select').first().selectOption('99999');
  const firstRef = () => page.locator('tbody tr').first().locator('.row-sub b').textContent();
  const lastRef = () => page.locator('tbody tr').last().locator('.row-sub b').textContent();
  const newest = await firstRef();
  const oldest = await lastRef();
  await page.getByLabel('Tri').selectOption('asc');
  await expect(page.locator('tbody tr').first().locator('.row-sub b')).toHaveText(oldest);
  await expect(page.locator('tbody tr').last().locator('.row-sub b')).toHaveText(newest);
  // L'en-tête « Déclaré le » inverse aussi l'ordre
  await page.getByRole('button', { name: /Déclaré le/ }).click();
  await expect(page.getByLabel('Tri')).toHaveValue('desc');
  await expect(page.locator('tbody tr').first().locator('.row-sub b')).toHaveText(newest);
});

test('Un responsable corrige le montant et la commande d’un dossier', async ({ page }) => {
  await start(page);
  await view(page, 'Admin').click();
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('tbody tr').first().click();
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier les informations' });
  await dialog.getByLabel('Montant concerné par le litige (€) *').fill('2434.97');
  await dialog.getByLabel('Référence commande *').fill('CMD-CORRIGEE');
  await dialog.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByText('Informations du dossier modifiées').first()).toBeVisible();
  await expect(page.locator('.info-grid')).toContainText('CMD-CORRIGEE');
  await page.locator('.detail-tabs').getByRole('button', { name: 'Historique' }).click();
  await expect(page.locator('.timeline')).toContainText('Montant concerné par le litige');
  await expect(page.locator('.timeline')).toContainText('CMD-CORRIGEE');
});

test('Le bouton Modifier est réservé aux responsables', async ({ page }) => {
  await start(page);
  await view(page, 'Relation client').click();
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toHaveCount(0);
});

test('Les compteurs de statut suivent la période ; message et accès à toute la période', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('.period-picker select').first().selectOption('7');
  const rows = page.locator('tbody tr');
  // « Tous » est la dernière des vues de base
  const tous = page.locator('.filter-tabs button').last().locator('span');
  await expect(page.locator('.filter-tabs button').last()).toContainText('Tous');
  await expect(tous).toHaveText(String(await rows.count()));
  await expect(page.locator('.period-note')).toContainText('en dehors ne sont pas affichés');
  await page.getByRole('button', { name: 'Voir toute la période' }).click();
  await expect(page.locator('.period-note')).toHaveCount(0);
  await expect(tous).toHaveText('12');
  await expect(rows).toHaveCount(12);
  // Bas de la liste : « Voir tous les dossiers » remet statut, filtres et période à zéro
  await page.locator('.period-picker select').first().selectOption('7');
  await page.locator('.filter-tabs button').first().click();
  await page
    .locator('.table-footer')
    .getByRole('button', { name: 'Voir tous les dossiers' })
    .click();
  await expect(page.locator('.filter-tabs button.active')).toContainText('Tous');
  await expect(page.locator('.period-note')).toHaveCount(0);
  await expect(rows).toHaveCount(12);
});

test('Retour à la liste : défilement jusqu’au dossier quitté et animation de sa ligne', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await start(page);
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('.period-picker select').first().selectOption('99999');
  const row = page.locator('tbody tr').nth(10);
  const id = await row.getAttribute('data-record-id');
  await row.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Retour aux dossiers' }).click();
  const back = page.locator('tr[data-record-id="' + id + '"]');
  await expect(back).toHaveClass(/row-flash/);
  await expect(back).toBeInViewport();
});

test('Un dossier s’ouvre en haut de page ; enseignes en couleur', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await start(page);
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('.period-picker select').first().selectOption('99999');
  await expect(page.locator('tbody .brand-name[data-brand="grosbill"]').first()).toHaveCSS(
    'color',
    'rgb(209, 32, 43)',
  );
  await expect(page.locator('tbody .brand-name[data-brand="picata"]').first()).toHaveCSS(
    'color',
    'rgb(29, 138, 62)',
  );
  const row = page.locator('tbody tr').nth(11);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.locator('.detail-heading')).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('Repères de montant réglables par un responsable (contour rouge)', async ({ page }) => {
  await start(page);
  await view(page, 'Admin').click();
  await page.getByRole('button', { name: 'Paramètres' }).click();
  const panel = page.locator('.amount-alert-settings');
  await panel.getByLabel(/Contour orangé/).fill('500');
  await panel.getByLabel(/Contour rouge/).fill('1500');
  await panel.getByRole('button', { name: 'Enregistrer les repères' }).click();
  await expect(page.getByText('Modifications enregistrées').first()).toBeVisible();
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('.period-picker select').first().selectOption('99999');
  // Démonstration : un dossier de 2 450 € est en rouge, un de 879 € en orange
  await expect(
    page.locator('tbody tr.very-high-amount').filter({ hasText: /2\s450,00/ }),
  ).toHaveCount(1);
  await expect(page.locator('tbody tr.high-amount').filter({ hasText: '879,00' })).toHaveCount(1);
});

test('Paramètres : ajouter une enseigne avec sa couleur, renommer un transporteur', async ({
  page,
}) => {
  await start(page);
  await view(page, 'Admin').click();
  await page.getByRole('button', { name: 'Paramètres' }).click();
  // Nouvelle enseigne, proposée ensuite à la création
  const brandsCard = page
    .locator('.list-editor')
    .filter({ has: page.getByRole('heading', { name: 'Enseignes' }) });
  await brandsCard.getByLabel('Ajouter à Enseignes').fill('NOUVEAU CONTRAT');
  await brandsCard.getByRole('button', { name: 'Ajouter' }).click();
  await brandsCard.getByLabel('Couleur de NOUVEAU CONTRAT').fill('#8a2be2');
  await brandsCard.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Liste enregistrée').first()).toBeVisible();
  // Renommer un transporteur, aussi dans les anciens dossiers
  const carriersCard = page
    .locator('.list-editor')
    .filter({ has: page.getByRole('heading', { name: 'Transporteurs' }) });
  await carriersCard.getByLabel('Nom : TNT').fill('TNT FEDEX');
  await expect(carriersCard.getByText('Renommer aussi dans les anciens dossiers')).toBeVisible();
  await carriersCard.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Liste enregistrée').first()).toBeVisible();
  // L'enseigne est proposée à la création ; le transporteur renommé apparaît dans la liste
  await page.getByRole('button', { name: 'Dossiers litiges' }).click();
  await page.locator('.period-picker select').first().selectOption('99999');
  await expect(page.locator('tbody')).toContainText('TNT FEDEX');
  await page.getByRole('button', { name: 'Nouveau litige' }).first().click();
  await expect(
    page.getByLabel('Enseigne *').locator('option', { hasText: 'NOUVEAU CONTRAT' }),
  ).toHaveCount(1);
});

test('Graphiques : format au choix et disposition déplaçable, retenus au rechargement', async ({
  page,
}) => {
  await start(page);
  await view(page, 'Admin').click();
  await page.getByRole('button', { name: 'Analyses litiges' }).click();
  const brands = page.locator('[data-card="brands"]');
  await brands.getByRole('button', { name: 'Camembert' }).click();
  await expect(brands.locator('.ring-figure')).toBeVisible();
  // Disposition verrouillée par défaut : pas de flèches
  await expect(page.getByRole('button', { name: 'Avancer ce graphique' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Déplacer les graphiques' }).click();
  await brands.getByRole('button', { name: 'Avancer ce graphique' }).click();
  const order = () =>
    page.locator('.visual-slot').evaluateAll((els) => els.map((e) => e.getAttribute('data-card')));
  expect((await order()).indexOf('brands')).toBe(2);
  await page.getByRole('button', { name: 'Verrouiller la disposition' }).click();
  await expect(page.getByRole('button', { name: 'Avancer ce graphique' })).toHaveCount(0);
  // Retenu au rechargement (démonstration : enregistré dans le navigateur)
  await page.reload();
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Analyses litiges' }).click();
  expect((await order()).indexOf('brands')).toBe(2);
  await expect(page.locator('[data-card="brands"] .ring-figure')).toBeVisible();
});

test('Fiche : suivi du colis affiché en haut (frise et historique)', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: /Dossiers litiges/ }).click();
  await page
    .locator('tbody tr')
    .filter({ has: page.locator('.origin', { hasText: 'Transport' }) })
    .first()
    .locator('.row-title')
    .click();
  const panel = page.locator('.parcel-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.parcel-steps li')).toHaveCount(5);
  await expect(panel.locator('.parcel-events li').first()).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Page du transporteur' })).toHaveAttribute(
    'target',
    '_blank',
  );
  // Repliable, et retenu
  await panel.getByRole('button', { name: 'Masquer' }).click();
  await expect(panel.locator('.parcel-steps')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Afficher' }).click();
  await expect(panel.locator('.parcel-steps')).toBeVisible();
});

test('Suivre un dossier : les messages des autres arrivent dans « Abonnements »', async ({
  page,
}) => {
  await start(page);
  await view(page, 'Relation client').click();
  await page.getByRole('button', { name: /Dossiers litiges/ }).click();
  const row = page.locator('tbody tr').first();
  const ref = (await row.locator('.row-sub b').textContent()).trim();
  await row.click();
  await page.getByRole('button', { name: 'Suivre ce dossier' }).click();
  await expect(page.getByRole('button', { name: 'Suivi', exact: true })).toBeVisible();

  // Un autre service écrit sur le dossier
  await page.getByRole('button', { name: 'Retour aux dossiers' }).click();
  await view(page, 'Service Litige').click();
  await page.getByRole('button', { name: /Dossiers litiges/ }).click();
  await page.locator('tbody tr').filter({ hasText: ref }).first().click();
  await page.getByPlaceholder(/Écrivez votre commentaire/).fill('Le transporteur a répondu.');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Commentaire ajouté').first()).toBeVisible();

  // La RC est prévenue
  await page.getByRole('button', { name: 'Retour aux dossiers' }).click();
  await view(page, 'Relation client').click();
  await page.getByRole('button', { name: 'Notifications' }).click();
  const tab = page.locator('.notification-tabs').getByRole('tab', { name: /Abonnements/ });
  await expect(tab).toContainText('1');
  await tab.click();
  await expect(page.locator('.notifications')).toContainText('Nouveau message : ' + ref);
  await expect(page.locator('.notifications')).toContainText('Le transporteur a répondu.');
});

test('Ma journée, rappels, actions groupées, modèles de réclamation et rapport', async ({
  page,
}) => {
  await start(page);
  // L'outil s'ouvre sur « Ma journée »
  await expect(page.locator('h1')).toHaveText('Votre journée, par ordre de priorité.');
  await view(page, 'Service Litige').click();
  await expect(page.locator('.day-section').first()).toBeVisible();

  // Actions groupées : cocher deux dossiers et les suivre
  await page.getByRole('button', { name: /Dossiers litiges/ }).click();
  const boxes = page.locator('tbody td.pick-col input');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await expect(page.locator('.bulk-bar')).toContainText('2 dossier(s) sélectionné(s)');
  await page.locator('.bulk-bar').getByRole('button', { name: 'Suivre', exact: true }).click();
  await expect(page.getByText('Vous suivez 2 dossier(s)').first()).toBeVisible();
  // Changer de statut affiché vide la sélection (pas d'action sur des dossiers invisibles)
  await boxes.nth(0).check();
  await expect(page.locator('.bulk-bar')).toBeVisible();
  await page.locator('.filter-tabs button').nth(1).click();
  await expect(page.locator('.bulk-bar')).toHaveCount(0);
  await page.locator('.filter-tabs button').first().click();

  // Rappel personnel sur un dossier (date du jour → arrive tout de suite)
  await page.locator('tbody tr').filter({ hasText: 'Transport' }).first().click();
  await page.getByRole('button', { name: 'Me rappeler le…' }).click();
  const today = await page.evaluate(() =>
    new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }),
  );
  await page.locator('.reminder-form input[type=date]').fill(today);
  await page.locator('.reminder-form').getByLabel('Note (facultatif)').fill('Rappeler le client');
  await page.getByRole('button', { name: 'Programmer' }).click();
  await expect(page.locator('.reminder-chip')).toContainText('Rappeler le client');

  // Modèle de réclamation rempli avec le dossier
  await page.getByRole('button', { name: /^Transporteur/ }).click();
  // Le modèle remplit directement le cadre « Écrire un e-mail »
  const claim = page.locator('.transport-compose');
  await expect(claim.locator('input[maxlength="300"]')).toHaveValue(/LIT-/);
  await claim.locator('select').nth(1).selectOption({ label: 'Message libre (sans modèle)' });
  await expect(claim.locator('textarea')).toHaveValue('');
  await claim.locator('select').nth(1).selectOption({ index: 1 });
  await expect(claim.locator('textarea')).toHaveValue(/Notre référence de dossier : LIT-/);
  // Signature proposée sous le message (Paramètres → Signatures d’e-mail)
  await expect(claim.locator('.transport-signature-preview')).toContainText('Cordialement');

  // Le rappel apparaît dans « Ma journée »
  await page.getByRole('button', { name: 'Retour aux dossiers' }).click();
  await page.getByRole('button', { name: /Ma journée/ }).click();
  await expect(page.locator('#jour-reminders')).toContainText('Rappeler le client');
  await page.locator('#jour-reminders').getByRole('button', { name: 'Fait' }).click();
  await expect(page.locator('#jour-reminders')).toHaveCount(0);

  // Rapport PDF depuis Analyses
  await page.getByRole('button', { name: 'Analyses litiges' }).click();
  await page.getByRole('button', { name: 'Rapport (PDF)' }).click();
  await expect(page.locator('.report-sheet h1')).toHaveText('Rapport des litiges');
  await expect(page.locator('.report-tiles > div')).toHaveCount(9);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator('.report-sheet')).toHaveCount(0);
});

test('Rythme des litiges : infobulle au survol, colonnes dans le cadre, vue par semaine', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: /Vue d’ensemble/ }).click();
  const chart = page.locator('.visual-line-chart');
  const card = chart.locator('xpath=ancestor::section[1]');
  // Survol d'un jour : infobulle avec les chiffres
  await chart.locator('.chart-hit').nth(5).hover();
  await expect(chart.locator('.chart-tooltip')).toContainText('Ouvertures');
  await expect(chart.locator('.chart-tooltip')).toContainText('Clôtures');
  // Colonnes : les barres restent entre l'axe et le bord droit
  await card.getByRole('button', { name: 'Colonnes' }).click();
  const box = await chart.locator('svg').boundingBox();
  const bars = await chart
    .locator('svg rect:not(.chart-hit)')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right]));
  for (const [l, r] of bars) {
    expect(l).toBeGreaterThan(box.x + box.width * 0.04);
    expect(r).toBeLessThan(box.x + box.width * 0.98);
  }
  // Par semaine : 12 semaines, infobulle « Semaine… »
  await card.getByRole('button', { name: 'Par semaine' }).click();
  await expect(chart.locator('.chart-hit')).toHaveCount(12);
  await chart.locator('.chart-hit').last().hover();
  await expect(chart.locator('.chart-tooltip')).toContainText('Semaine en cours');
});

test('Rapport : période par dates et téléchargement du PDF', async ({ page }) => {
  await start(page);
  await view(page, 'Service Litige').click();
  await page.getByRole('button', { name: 'Analyses litiges' }).click();
  await page.getByRole('button', { name: 'Rapport (PDF)' }).click();
  await page.getByRole('button', { name: 'Par dates' }).click();
  await page.locator('.report-period').getByLabel('Du', { exact: true }).fill('2026-01-01');
  await page.locator('.report-period').getByLabel('au', { exact: true }).fill('2026-12-31');
  await expect(page.locator('.report-sheet header')).toContainText('Du 01/01/2026 au 31/12/2026');
  // Dates inversées : message, pas de rapport ni de téléchargement
  await page.locator('.report-period').getByLabel('Du', { exact: true }).fill('2027-01-05');
  await expect(page.locator('.report-period-error')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Télécharger le PDF' })).toBeDisabled();
  await page.locator('.report-period').getByLabel('Du', { exact: true }).fill('2026-01-01');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(
    'OptiLitige - Rapport des litiges - du 01-01-2026 au 31-12-2026.pdf',
  );
  const head = (await import('node:fs'))
    .readFileSync(await file.path())
    .subarray(0, 8)
    .toString();
  expect(head).toBe('%PDF-1.4');
});

test('Mode sombre : le panneau des notifications passe devant le tableau de bord', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await page.getByRole('button', { name: /Vue d’ensemble/ }).click();
  await page.getByRole('button', { name: 'Notifications' }).click();
  const panel = page.locator('.notifications');
  await expect(panel).toBeVisible();
  const onTop = await panel.evaluate((p) => {
    const b = p.getBoundingClientRect();
    return [
      [b.left + 20, b.bottom - 20],
      [b.left + b.width / 2, b.top + b.height * 0.75],
    ].every(([x, y]) => p.contains(document.elementFromPoint(x, y)));
  });
  expect(onTop).toBe(true);
});

test('Relances transporteur : dates remplies seules, modifiables, « Relance faite »', async ({
  page,
}) => {
  await start(page);
  await view(page, 'Service Litige').click();
  await page.getByRole('button', { name: /Dossiers litiges/ }).click();
  await page.locator('tbody tr').filter({ hasText: 'Transport' }).first().click();
  const form = page.locator('.panel.treatment form');
  // Dates vides (nouveau dossier) : elles se remplissent à la saisie de la transmission
  await form.getByLabel('Prochaine relance').fill('');
  await form.getByLabel('Réponse attendue le').fill('');
  await form.getByLabel('Transmission au transporteur').fill('');
  await form.getByLabel('Transmission au transporteur').fill('2026-11-12');
  await expect(form.getByLabel('Prochaine relance')).toHaveValue('2026-11-19');
  await expect(form.getByLabel('Réponse attendue le')).toHaveValue('2026-11-27');
  // Modifiable à la main
  await form.getByLabel('Prochaine relance').fill('2026-11-16');
  await expect(form.getByLabel('Prochaine relance')).toHaveValue('2026-11-16');
  await form.getByRole('button', { name: 'Enregistrer le traitement' }).click();
  await expect(page.getByText('Modifications enregistrées').first()).toBeVisible();
  // « Relance faite » : prochaine relance = aujourd'hui + 7 jours
  await form.getByRole('button', { name: 'Relance faite' }).click();
  await expect(page.getByText(/Relance notée/).first()).toBeVisible();
  const expected = await page.evaluate(() => {
    const d = new Date(
      new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) + 'T12:00:00Z',
    );
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  await expect(form.getByLabel('Prochaine relance')).toHaveValue(expected);
  // Guide : mêmes étapes que le formulaire
  await expect(page.locator('.treatment-guide li')).toHaveCount(5);
  await expect(page.locator('.panel.treatment h3')).toContainText([
    '1. Statut et prise en charge',
    '2. Réclamation au transporteur',
    '3. Réponse du transporteur',
    '4. Solution pour le client',
    '5. Clôture',
  ]);
});

test('Aides : masquer et rouvrir (fiche et petites aides), choix retenu', async ({ page }) => {
  await start(page);
  // Petite aide de Ma journée
  await expect(page.locator('.help-tip', { hasText: 'Ma journée' })).toBeVisible();
  await page
    .locator('.help-tip', { hasText: 'Ma journée' })
    .getByRole('button', { name: 'Masquer l’aide' })
    .click();
  await expect(page.locator('.help-tip', { hasText: 'Ma journée' })).toHaveCount(0);
  await page.reload();
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await expect(page.getByRole('button', { name: 'Ouvrir l’aide' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir l’aide' }).first().click();
  await expect(page.locator('.help-tip', { hasText: 'Ma journée' })).toBeVisible();

  // Fiche : la colonne « Qui fait quoi » se masque (onglet au bord droit) puis se rouvre
  await page.getByRole('button', { name: /Dossiers litiges/ }).click();
  await page.locator('tbody tr').first().click();
  const guide = page.locator('.detail-guide');
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Masquer l’aide' }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.locator('.help-dock')).toBeVisible();
  await page.locator('.help-dock').click();
  await expect(page.locator('.detail-guide')).toBeVisible();
  await expect(page.locator('.help-dock')).toHaveCount(0);
});

test('Clôturer en deux clics : imputation proposée, conclusion déduite', async ({ page }) => {
  await page.goto('/');
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  // Liste des résultats d'origine pour ce test (démonstration neuve)
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Dossiers litiges' }).first().click();
  await page
    .locator('.view-tabs')
    .getByRole('button', { name: 'Service Litige', exact: true })
    .click();
  await page.locator('.period-picker select').first().selectOption('99999');
  await page
    .locator('tbody tr')
    .filter({ hasText: 'Pris en charge' })
    .first()
    .locator('.row-title')
    .click();
  await page.getByRole('button', { name: 'Clôturer le dossier' }).click();
  const dialog = page.locator('.modal');
  await dialog.getByLabel('Résultat du litige *').selectOption('Livraison conforme');
  await expect(dialog.getByLabel('Imputation *')).toHaveValue('Autre');
  await dialog.getByRole('button', { name: 'Clôturer', exact: true }).click();
  await expect(page.locator('.treatment').getByLabel('Statut du dossier')).toHaveValue('Résolu');
  await expect(page.locator('.treatment').getByLabel('Décision du transporteur')).toHaveValue(
    'Ne concerne pas le transporteur',
  );
  await expect(page.getByText('Dernière résolution : Non avéré')).toBeVisible();
});

test('Contentieux : espace des responsables, liaison au dossier, client récidiviste', async ({
  page,
}) => {
  await start(page);
  // Pas d'espace Contentieux pour la RC
  await view(page, 'Relation client').click();
  await expect(page.locator('.sidebar').getByRole('button', { name: /^Contentieux/ })).toHaveCount(
    0,
  );
  await view(page, 'Admin').click();
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /^Contentieux/ })
    .click();
  // 4 contentieux, chacun à sa date ; ceux du même client se déplient sous chaque ligne
  await expect(page.locator('.ct-table tbody tr')).toHaveCount(4);
  // Plus récents d'abord par défaut, plus anciens au choix
  await expect(page.locator('.ct-table tbody tr').first()).toContainText('CMD-84700');
  await page.getByLabel('Tri par date').selectOption('asc');
  await expect(page.locator('.ct-table tbody tr').first()).toContainText('CMD-84687');
  // Contentieux relié à un dossier indemnisé par le transporteur : perte réelle
  await page.locator('.ct-table tbody tr').first().click();
  const loss = page.getByRole('group', { name: 'Perte réelle' });
  await expect(loss).toContainText('1 449,86 €');
  await expect(loss).toContainText('− 80,00 €');
  await expect(loss).toContainText('1 369,86 €');
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
  await page.getByLabel('Tri par date').selectOption('desc');
  // Commande en première colonne, type sans numéro
  const row = page.locator('.ct-table tbody tr').filter({ hasText: 'CMD-84739' });
  await expect(row.locator('.ct-type')).toHaveText('Signal Conso (DGCCRF)');
  // Le contentieux Signal Conso a un dossier litige sur la même commande : liaison proposée
  await expect(row).toContainText('À relier ?');
  await expect(row).toContainText('1 autre contentieux');
  await row.getByRole('button', { name: '1 autre contentieux' }).click();
  await expect(page.locator('.ct-table tbody tr.ct-child')).toContainText('CMD-70011');
  await row.getByRole('button', { name: '1 autre contentieux' }).click();
  await expect(page.locator('.ct-table tbody tr.ct-child')).toHaveCount(0);
  await row.click();
  const dialog = page.getByRole('dialog', { name: 'Contentieux CT-2026-D0001' });
  await expect(dialog).toContainText(
    'Un dossier litige existe pour la commande CMD-84739 : LIT-2026-1283',
  );
  await expect(dialog).toContainText('Ce client a déjà 1 autre(s) contentieux');
  await dialog.getByRole('button', { name: 'Relier ce dossier' }).click();
  await expect(dialog).toContainText('Relié au dossier litige LIT-2026-1283');
  await expect(dialog.locator('.ct-history')).toContainText(
    'Relié au dossier litige LIT-2026-1283',
  );
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(row).toContainText('LIT-2026-1283');
  // Nouveau contentieux du même client, même type et même commande qu'un autre : signalé
  await page.getByRole('button', { name: 'Nouveau contentieux' }).click();
  const form = page.getByRole('dialog', { name: 'Nouveau contentieux' });
  await form.getByLabel('Type de contentieux *').selectOption('Médiation');
  await expect(form).toContainText('Délai légal de réponse : 21 jours');
  await form.getByLabel('Client (n° de compte)').fill('C102938');
  await form.getByLabel('N° de commande').fill('CMD-70011');
  await expect(form).toContainText('Déjà un contentieux « Médiation » pour cette commande');
  // Le sous-sujet dépend du sujet
  await expect(form.getByLabel('Sous-sujet')).toBeDisabled();
  await form.getByLabel(/^Sujet/).selectOption('Rétractation');
  await form.getByLabel('Sous-sujet').selectOption('Frais de retour contestés');
  await form.getByLabel('Montant frais (€)').fill('14');
  // Message du client et réponse apportée, en plus du commentaire
  await form.getByLabel('Message client').fill('Je conteste les frais de retour.');
  await form.getByLabel('Réponse apportée au client').fill('Frais de retour remboursés.');
  await expect(form.getByLabel('Commentaire')).toBeVisible();
  await form.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('.ct-table tbody tr').filter({ hasText: 'C102938' }).first().click();
  await expect(page.getByLabel('Message client')).toHaveValue('Je conteste les frais de retour.');
  // Pièces jointes : disponibles dans l'espace réel (la démo l'indique)
  await expect(page.locator('.ct-attachments')).toContainText(
    'stockées avec le contentieux et visibles par les admins',
  );
  await page.getByRole('button', { name: 'Fermer' }).click();
  // Le nouveau contentieux du client : ses deux autres contentieux se déplient en dessous
  const lead = page.locator('.ct-table tbody tr').filter({ hasText: 'C102938' }).first();
  await expect(lead).toContainText('2 autres contentieux');
  await lead.getByRole('button', { name: '2 autres contentieux' }).click();
  await expect(page.locator('.ct-table tbody tr.ct-child')).toHaveCount(2);
  // Côté dossier litige : le contentieux relié apparaît
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /^Dossiers litiges/ })
    .click();
  await page.getByLabel('Rechercher un dossier').fill('CMD-84739');
  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('group', { name: 'Contentieux' })).toContainText('CT-2026-D0001');
});

test('Paramètres en deux parties ; listes des contentieux modifiables', async ({ page }) => {
  await start(page);
  await view(page, 'Admin').click();
  await page.locator('.sidebar').getByRole('button', { name: 'Paramètres' }).click();
  // Partie litiges par défaut, partie contentieux à côté
  await expect(page.getByRole('tab', { name: 'Paramètres litiges' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Paramètres contentieux' }).click();
  // Nouvelle décision
  const decisions = page.locator('.list-editor').filter({ hasText: 'Décisions' });
  await decisions.getByLabel('Ajouter à Décisions').fill('Geste commercial');
  await decisions.getByRole('button', { name: 'Ajouter' }).click();
  await decisions.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Listes des contentieux enregistrées').first()).toBeVisible();
  // Nouveau sous-sujet pour le sujet Transporteur
  await page.getByLabel(/^Sous-sujets du sujet/).selectOption('Transporteur');
  const subs = page.locator('.list-editor').filter({ hasText: 'Sous-sujets : Transporteur' });
  await subs.getByLabel('Ajouter à Sous-sujets : Transporteur').fill('Colis bloqué en douane');
  await subs.getByRole('button', { name: 'Ajouter' }).click();
  await subs.getByRole('button', { name: 'Enregistrer' }).click();
  // Délai d'un type modifié
  await page.getByLabel('Délai légal en jours : Médiation').fill('30');
  await page.locator('.ct-kinds-editor').getByRole('button', { name: 'Enregistrer' }).click();
  // Les nouvelles valeurs sont proposées dans un nouveau contentieux
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /^Contentieux/ })
    .click();
  await page.getByRole('button', { name: 'Nouveau contentieux' }).click();
  const form = page.getByRole('dialog', { name: 'Nouveau contentieux' });
  await form.getByLabel('Type de contentieux *').selectOption('Médiation');
  await expect(form).toContainText('Délai légal de réponse : 30 jours');
  await form.getByLabel(/^Sujet/).selectOption('Transporteur');
  await form.getByLabel('Sous-sujet').selectOption('Colis bloqué en douane');
  await form.getByLabel(/^Décision/).selectOption('Geste commercial');
});

test('Analyses litiges et Analyses contentieux (responsables)', async ({ page }) => {
  await start(page);
  // Menu par rôle : RC sans Analyses litiges mais avec Ma data, vue d'ensemble en dernier ;
  // Responsable avec Analyses litiges, sans Équipe & accès ni Contentieux
  await view(page, 'Relation client').click();
  const menu = page.locator('.sidebar nav button');
  await expect(menu).toHaveText([/Ma journée/, /Dossiers litiges/, /Ma data/, /Vue d’ensemble/]);
  await page.locator('.sidebar').getByRole('button', { name: 'Ma data' }).click();
  await expect(page.locator('.my-data .analytics-summary')).toContainText('Dossiers créés');
  await view(page, 'Responsable').click();
  await expect(
    page.locator('.sidebar').getByRole('button', { name: 'Analyses litiges' }),
  ).toBeVisible();
  await expect(page.locator('.sidebar').getByRole('button', { name: /Équipe/ })).toHaveCount(0);
  await expect(
    page.locator('.sidebar').getByRole('button', { name: 'Analyses contentieux' }),
  ).toHaveCount(0);
  // Analyses litiges : montant des avoirs, trois délais, volume ou valeur
  await page.locator('.sidebar').getByRole('button', { name: 'Analyses litiges' }).click();
  await expect(page.locator('.analytics-summary')).toContainText('Montant des avoirs');
  await expect(page.locator('.analytics-summary')).toContainText('client / transporteur / dossier');
  await page
    .getByRole('group', { name: 'L’activité par enseigne : volume ou valeur' })
    .getByRole('button', { name: 'Valeur' })
    .click();
  await expect(page.locator('.stats-table thead').last()).toContainText(
    'Dossiers transmis au transporteur',
  );
  await expect(page.locator('.stats-table thead').last()).toContainText('Reste à notre charge (€)');
  // Récapitulatif d'un dossier au survol
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Dossiers litiges/ })
    .click();
  const recap = page.locator('tbody tr').first().locator('.dossier-recap');
  await recap.locator('button').hover();
  await expect(page.locator('.dossier-recap-card')).toBeVisible();
  await expect(page.locator('.dossier-recap-card')).toContainText('Commentaire à la création');
  await view(page, 'Admin').click();
  await page.locator('.sidebar').getByRole('button', { name: 'Analyses contentieux' }).click();
  await expect(page.locator('.analytics-summary')).toContainText('Contentieux de la période');
  await expect(page.locator('.analytics-summary')).toContainText('4');
  await expect(page.locator('.ct-dashboard')).toContainText('Évolution sur 12 mois');
  await expect(page.locator('.ct-money-table')).toContainText('Courrier recommandé');
  // Filtre par type : tout l'écran le suit
  await page.locator('.ct-dashboard-filter').getByLabel('Type').selectOption('Médiation');
  await expect(page.locator('.analytics-summary')).toContainText('1');
  await expect(page.locator('.ct-money-table tbody tr')).toHaveCount(2);
  // Rapport (PDF) des contentieux, avec les filtres de l'écran
  await page.getByRole('button', { name: 'Rapport (PDF)' }).click();
  const report = page.getByRole('dialog', { name: 'Rapport des contentieux' });
  await expect(report).toContainText('Contentieux reçus');
  await expect(report).toContainText('Perte réelle');
  await expect(report).toContainText('Filtres : Type : Médiation');
  const download = page.waitForEvent('download');
  await report.getByRole('button', { name: 'Télécharger le PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^OptiLitige - Rapport des contentieux - .+.pdf$/);
  const head = (await import('node:fs'))
    .readFileSync(await file.path())
    .subarray(0, 8)
    .toString();
  expect(head).toBe('%PDF-1.4');
  await report.getByRole('button', { name: 'Fermer' }).click();
});
