import test from 'node:test';
import assert from 'node:assert/strict';
import { creditIssuedStamp, creditToday, resolveCredit } from '../app/credit.mjs';
const now = new Date('2026-10-28T10:00:00Z');
const empty = { creditNumber: '', creditIssued: false, credit: 0, creditCreated: null };
test('Le numéro active l’avoir, conserve les centimes et date automatiquement', () => {
  assert.deepEqual(resolveCredit(empty, { creditNumber: ' AV-123 ', credit: 49.9 }, now), {
    creditNumber: 'AV-123',
    creditIssued: true,
    credit: 49.9,
    creditCreated: '2026-10-28',
  });
});
test('La date par défaut suit le calendrier de Paris', () => {
  assert.equal(creditToday(new Date('2026-10-27T23:30:00Z')), '2026-10-28');
});
test('La date réelle peut être antérieure au jour de saisie', () => {
  assert.equal(
    resolveCredit(empty, { creditNumber: 'AV-123', credit: 49.9, creditCreated: '2026-10-23' }, now)
      .creditCreated,
    '2026-10-23',
  );
});
test('Une date corrigée est conservée lors des enregistrements suivants', () => {
  const stored = resolveCredit(
    empty,
    { creditNumber: 'AV-123', credit: 49.9, creditCreated: '2026-10-23' },
    now,
  );
  assert.equal(
    resolveCredit(
      stored,
      { creditNumber: 'AV-123', credit: 59.9 },
      new Date('2026-10-30T12:00:00Z'),
    ).creditCreated,
    '2026-10-23',
  );
  assert.equal(
    resolveCredit(stored, { creditNumber: 'AV-CORRIGE', credit: 49.9 }, now).creditCreated,
    '2026-10-23',
  );
});
test('Le numéro remplace entièrement l’ancienne case à cocher', () => {
  assert.equal(
    resolveCredit(empty, { creditNumber: 'AV-123', credit: 0, creditIssued: false }, now)
      .creditIssued,
    true,
  );
  assert.equal(
    resolveCredit(empty, { creditNumber: '', credit: 20, creditIssued: true }, now).creditIssued,
    false,
  );
});
test('Retirer un numéro retire aussi le montant et la date du suivi', () => {
  const stored = resolveCredit(empty, { creditNumber: 'AV-123', credit: 49.9 }, now);
  assert.deepEqual(resolveCredit(stored, { creditNumber: '', credit: 49.9 }, now), empty);
});
test('Un ancien avoir importé sans numéro n’est pas supprimé par une autre modification', () => {
  const legacy = {
    creditNumber: '',
    creditIssued: true,
    credit: 100.25,
    creditCreated: '2025-08-21',
  };
  assert.deepEqual(resolveCredit(legacy, { creditNumber: '', credit: 0 }, now), legacy);
});
test('Un numéro historique sans date reste identifié comme date inconnue', () => {
  const imported = {
    creditNumber: 'AV-ANCIEN',
    creditIssued: true,
    credit: 50,
    creditCreated: null,
  };
  assert.equal(
    resolveCredit(imported, { creditNumber: 'AV-ANCIEN', credit: 50 }, now).creditCreated,
    null,
  );
});
test('Les montants négatifs ou non numériques et dates invalides sont refusés', () => {
  for (const credit of [-1, NaN, Infinity])
    assert.throws(() => resolveCredit(empty, { creditNumber: 'AV-123', credit }, now));
  assert.throws(() =>
    resolveCredit(empty, { creditNumber: 'AV-123', credit: 50, creditCreated: '2026-02-30' }, now),
  );
});

test('Moment d’émission de l’avoir : nouveau n° ou montant renseigné seulement', () => {
  const t1 = '2026-11-24T09:00:00.000Z';
  const t2 = '2026-11-25T09:00:00.000Z';
  assert.equal(creditIssuedStamp({}, { creditNumber: 'AV-1', credit: 10 }, t1), t1);
  // N° sans montant, puis montant ajouté plus tard
  assert.equal(creditIssuedStamp({}, { creditNumber: 'AV-1', credit: 0 }, t1), null);
  assert.equal(
    creditIssuedStamp(
      { creditNumber: 'AV-1', credit: 0 },
      { creditNumber: 'AV-1', credit: 10 },
      t2,
    ),
    t2,
  );
  // Autre modification du dossier : le moment ne change pas
  const stored = { creditNumber: 'AV-1', credit: 10, creditIssuedAt: t1 };
  assert.equal(creditIssuedStamp(stored, { creditNumber: 'AV-1', credit: 12 }, t2), t1);
  // Nouveau n° : nouvelle notification
  assert.equal(creditIssuedStamp(stored, { creditNumber: 'AV-2', credit: 10 }, t2), t2);
  // Dossier repris avec un avoir : pas de moment inventé
  assert.equal(
    creditIssuedStamp({ creditNumber: 'AV-0', credit: 5 }, { creditNumber: 'AV-0', credit: 5 }, t2),
    null,
  );
  // Avoir retiré
  assert.equal(creditIssuedStamp(stored, { creditNumber: '', credit: 0 }, t2), null);
});
