import { test, expect } from '@playwright/test';
test('Récapitulatif au survol : toujours dans l’écran, en haut comme en bas de la liste', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 800 });
  await page.goto('/');
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await page.locator('.view-tabs').getByRole('button', { name: 'Admin', exact: true }).click();
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Dossiers litiges/ })
    .click();
  const rows = page.locator('tbody tr');
  for (const [i] of [
    [0, 'haut'],
    [-1, 'bas'],
  ]) {
    const row = i < 0 ? rows.last() : rows.nth(i);
    await row.scrollIntoViewIfNeeded();
    await row.locator('.dossier-recap button').hover();
    const card = page.locator('.dossier-recap-card');
    await expect(card).toBeVisible();
    const b = await card.boundingBox();
    const vp = page.viewportSize();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    await page.mouse.move(5, 5);
    await expect(card).toHaveCount(0);
  }
});
