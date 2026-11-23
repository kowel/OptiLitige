import test from 'node:test';
import assert from 'node:assert/strict';
import { guess, statusGuess, dateValue, numberValue, transform } from '../app/import-logic.mjs';
test('Reconnaissance colonnes Microsoft Lists', () => {
  const m = guess(['ID', 'Titre', 'Date de création', 'Statut', 'Montant commande']);
  assert.equal(m.externalId, 'ID');
  assert.equal(m.created, 'Date de création');
  assert.equal(m.status, 'Statut');
});
test('Statuts métier et inconnus', () => {
  assert.equal(statusGuess('Traité'), 'Résolu');
  assert.equal(statusGuess('En cours'), 'Pris en charge');
  assert.equal(statusGuess('En attente RC'), 'En attente RC');
  assert.equal(statusGuess('Pas clair'), '');
});
test('Montants français et dates Excel', () => {
  assert.equal(numberValue('1 299,90 €'), 1299.9);
  assert.equal(numberValue('1234.56'), 1234.56);
  assert.ok(Number.isNaN(numberValue('-10')));
  assert.equal(dateValue('28/10/2026'), '2026-10-28T00:00:00.000Z');
  assert.equal(dateValue('31/02/2026'), false);
  assert.equal(dateValue(1), '1899-12-31T00:00:00.000Z');
});
const map = {
    title: 'Titre',
    created: 'Ouvert',
    closed: 'Clos',
    status: 'Statut',
    amount: 'Montant',
  },
  defs = { status: '', origin: 'Transport', type: 'Non classé (import)', sourceList: 'SAV' };
test('Dossiers traités conservent dates, montants et champs source', () => {
  const result = transform(
    [
      {
        Titre: 'Ancien litige',
        Ouvert: '01/10/2026',
        Clos: '03/10/2026',
        Statut: 'Traité',
        Montant: '1 299,90',
        Autre: 'Conserver',
      },
    ],
    map,
    { Traité: 'Résolu' },
    defs,
  )[0];
  assert.deepEqual(result.errors, []);
  assert.equal(result.record.status, 'Résolu');
  assert.equal(result.record.amount, 1299.9);
  assert.equal(result.record.closed, '2026-10-03T00:00:00.000Z');
  assert.equal(result.record.sourceData.Autre, 'Conserver');
  assert.equal(result.record.resolution.verdict, 'Non renseigné (import)');
});
test('Date de clôture antérieure à l’ouverture : dossier repris, date ignorée et signalée', () => {
  const r = transform(
    [{ Titre: 'Test', Ouvert: '01/10/2026', Clos: '30/09/2026', Statut: 'Traité', Montant: 12 }],
    map,
    { Traité: 'Résolu' },
    defs,
  )[0];
  assert.deepEqual(r.errors, []);
  assert.equal(r.record.closed, null);
  assert.ok(r.warnings.some((w) => w.includes('antérieure à l’ouverture')));
});

test('Export SharePoint en anglais : montants, statut « En cours / … », urgence, transporteur', async () => {
  const { numberValue, statusGuess, carrierFollowup } = await import('../app/import-logic.mjs');
  assert.equal(numberValue('1,205.99 €'), 1205.99);
  assert.equal(numberValue('1.205,99 €'), 1205.99);
  assert.equal(numberValue('13.99 €'), 13.99);
  assert.equal(statusGuess('En cours / Lydia'), 'Pris en charge');
  assert.deepEqual(carrierFollowup('Résolus', 'Oui'), {
    carrierStatus: 'Clos',
    carrierDecision: 'Accepté',
  });
  assert.deepEqual(carrierFollowup('Résolus', 'Non').carrierDecision, 'Refusé');
  assert.deepEqual(carrierFollowup('En cours', 'Non'), {
    carrierStatus: 'En attente réponse',
    carrierDecision: '',
  });
});
test('Statut inconnu et montant invalide ne sont pas inventés', () => {
  const r = transform(
    [{ Titre: 'Test', Ouvert: '01/10/2026', Statut: '?', Montant: 'err' }],
    map,
    {},
    defs,
  )[0];
  assert.ok(r.errors.includes('Statut non reconnu'));
  assert.ok(r.errors.some((e) => e.includes('Montant')));
});

test('Colonnes de la liste SAV et dates américaines explicites', () => {
  const m = guess([
    'Enseigne',
    'N° de CDE',
    'Montant CDE',
    'Date déclaration',
    'Type produit',
    'Résultat Litige',
    'Statut Client',
    'Valeurs indemnisation',
    'Litige avérée',
  ]);
  assert.equal(m.brand, 'Enseigne');
  assert.equal(m.order, 'N° de CDE');
  assert.equal(m.amount, 'Montant CDE');
  assert.equal(m.created, 'Date déclaration');
  assert.equal(m.status, 'Statut Client');
  assert.equal(m.compensation, 'Valeurs indemnisation');
  assert.equal(m.verdict, 'Litige avérée');
  assert.equal(dateValue('8/21/2025', 'us'), '2025-08-21T00:00:00.000Z');
  assert.equal(statusGuess('Résolus'), 'Résolu');
});

test('Reprise des anciens dossiers sans titre ni date de clôture sans inventer de date', () => {
  const r = transform(
    [{ ID: 2184, Commande: 6172134, Type: 'Inversion', Ouvert: '21/08/2025', Statut: 'Résolus' }],
    { externalId: 'ID', order: 'Commande', type: 'Type', created: 'Ouvert', status: 'Statut' },
    { Résolus: 'Résolu' },
    defs,
  )[0];
  assert.deepEqual(r.errors, []);
  assert.equal(r.record.title, 'Inversion · commande 6172134');
  assert.equal(r.record.closed, null);
  assert.ok(r.warnings.some((w) => w.includes('Date de clôture absente')));
});

test('« Assurer un suivi » : une case à cocher (Vrai / False) ne devient pas une action client', async () => {
  const { followUpText } = await import('../app/followup.ts');
  assert.equal(followUpText('False'), '');
  assert.equal(followUpText('Vrai'), '');
  assert.equal(followUpText(' true '), '');
  assert.equal(followUpText(undefined), '');
  assert.equal(followUpText('Rappeler le client lundi'), 'Rappeler le client lundi');
});
