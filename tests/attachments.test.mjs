import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDeleteAttachment,
  checkAttachment,
  cleanFileName,
  contentDisposition,
  contentTypeOf,
  formatSize,
  isInline,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_RECORD,
  REPRISE_LIMITS,
} from '../app/attachment-rules.mjs';

test('Formats acceptés et refusés', () => {
  for (const name of [
    'photo.JPG',
    'colis.heic',
    'BL.pdf',
    'réponse.msg',
    'suivi.xlsx',
    'note.txt',
    'photo.jfif',
    'deballage.mp4',
    'video.MOV',
  ])
    assert.equal(checkAttachment({ name, size: 1000 }), '', name);
  for (const name of [
    'page.html',
    'logo.svg',
    'script.js',
    'outil.exe',
    'archive.zip',
    'sans-extension',
  ])
    assert.match(checkAttachment({ name, size: 1000 }), /Format non accepté|invalide/, name);
});

test('Reprise de l’historique : limites élargies', () => {
  assert.equal(
    checkAttachment({ name: 'video.mp4', size: 73 * 1024 * 1024 }, 46, REPRISE_LIMITS),
    '',
  );
  assert.match(checkAttachment({ name: 'video.mp4', size: 73 * 1024 * 1024 }), /dépasse 15 Mo/);
  assert.match(
    checkAttachment({ name: 'gros.mp4', size: 96 * 1024 * 1024 }, 0, REPRISE_LIMITS),
    /dépasse 95 Mo/,
  );
});

test('Taille et nombre maximum', () => {
  assert.equal(checkAttachment({ name: 'a.pdf', size: MAX_ATTACHMENT_BYTES }), '');
  assert.match(checkAttachment({ name: 'a.pdf', size: MAX_ATTACHMENT_BYTES + 1 }), /15 Mo/);
  assert.match(checkAttachment({ name: 'a.pdf', size: 0 }), /vide/);
  assert.match(
    checkAttachment({ name: 'a.pdf', size: 10 }, MAX_ATTACHMENTS_PER_RECORD),
    /déjà 30 pièces jointes/,
  );
});

test('Le type vient de l’extension, jamais du navigateur', () => {
  assert.equal(contentTypeOf('Photo.PNG'), 'image/png');
  assert.equal(contentTypeOf('inconnu.bin'), 'application/octet-stream');
  assert.equal(isInline(contentTypeOf('a.jpg')), true);
  assert.equal(isInline(contentTypeOf('a.pdf')), false);
});

test('Noms de fichiers nettoyés et en-tête de téléchargement avec accents', () => {
  assert.equal(cleanFileName('C:\\Users\\agent\\Bon de livraison.pdf'), 'Bon de livraison.pdf');
  assert.equal(cleanFileName('../../secret"<>.pdf'), 'secret___.pdf');
  assert.equal(cleanFileName('..'), '');
  const long = cleanFileName('x'.repeat(300) + '.pdf');
  assert.equal(long.length, 150);
  assert.ok(long.endsWith('.pdf'));
  const header = contentDisposition('Réclamation colis.pdf', false);
  assert.ok(header.startsWith('attachment; filename="R_clamation colis.pdf"'));
  assert.ok(header.includes("filename*=UTF-8''R%C3%A9clamation%20colis.pdf"));
  assert.ok(contentDisposition('a.png', true).startsWith('inline;'));
});

test('Suppression réservée à l’auteur et aux responsables', () => {
  const a = { email: 'rc@cybertek.fr' };
  assert.equal(canDeleteAttachment(a, { email: 'RC@cybertek.fr', role: 'RC' }), true);
  assert.equal(
    canDeleteAttachment(a, { email: 'autre@cybertek.fr', role: 'Service Litige' }),
    false,
  );
  assert.equal(canDeleteAttachment(a, { email: 'chef@cybertek.fr', role: 'Admin' }), true);
});

test('Tailles lisibles', () => {
  assert.equal(formatSize(500), '500 o');
  assert.equal(formatSize(2048), '2 Ko');
  assert.equal(formatSize(3.5 * 1024 * 1024), '3,5 Mo');
});

test('Envoi direct : un identifiant déjà rattaché au dossier est refusé au « confirm »', async () => {
  const { confirmConflict } = await import('../app/attachment-rules.mjs');
  const list = [{ id: '11111111-1111-1111-1111-111111111111', name: 'photo.jpg' }];
  // Identifiant d'une pièce existante (celle d'un autre agent) : refus, son fichier reste intact
  assert.equal(confirmConflict(list, list[0].id), 'Pièce jointe déjà ajoutée.');
  // Identifiant nouveau (donné par « prepare ») : accepté
  assert.equal(confirmConflict(list, '22222222-2222-2222-2222-222222222222'), '');
  assert.equal(confirmConflict(undefined, '22222222-2222-2222-2222-222222222222'), '');
  assert.equal(confirmConflict([null], 'x'), '');
});
