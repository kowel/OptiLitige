import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TRASH_SETTINGS,
  normalizeTrashSettings,
  trashHistoryText,
} from '../app/trash-settings.mjs';

test('corbeille : aucun effacement automatique par défaut', () => {
  assert.deepEqual(DEFAULT_TRASH_SETTINGS, { autoPurge: false, days: 90 });
  assert.deepEqual(normalizeTrashSettings(null), { autoPurge: false, days: 90 });
  // Seul « true » active le vidage ; délai limité aux choix proposés
  assert.deepEqual(normalizeTrashSettings({ autoPurge: 'oui', days: 7 }), {
    autoPurge: false,
    days: 90,
  });
  assert.deepEqual(normalizeTrashSettings({ autoPurge: true, days: '180' }), {
    autoPurge: true,
    days: 180,
  });
});

test('corbeille : texte de l’historique selon le réglage', () => {
  assert.equal(
    trashHistoryText('photo.jpg', null),
    'Pièce jointe supprimée (rangée dans la corbeille) : photo.jpg',
  );
  assert.equal(
    trashHistoryText('photo.jpg', { autoPurge: true, days: 30 }),
    'Pièce jointe supprimée (rangée dans la corbeille, effacée après 30 jours) : photo.jpg',
  );
});
