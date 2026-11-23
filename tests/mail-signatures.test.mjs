import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SIGNATURES,
  composeHtml,
  composeText,
  normalizeSignatures,
  pickSignature,
} from '../app/mail-signatures.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('signatures : vérification, logo et largeur bornée', () => {
  const { signatures } = normalizeSignatures([
    {
      name: ' Grosbill ',
      brands: 'GROSBILL, GROSBILL.PRO',
      text: 'Cordialement',
      logo: PNG,
      logoWidth: 5000,
    },
  ]);
  assert.deepEqual(signatures[0].brands, ['GROSBILL', 'GROSBILL.PRO']);
  assert.equal(signatures[0].name, 'Grosbill');
  assert.equal(signatures[0].logoWidth, 600);
  assert.match(
    normalizeSignatures([{ name: 'X', text: 'a', logo: 'javascript:alert(1)' }]).error,
    /PNG/,
  );
  assert.match(normalizeSignatures([{ name: 'X', text: '' }]).error, /vide/);
  assert.match(normalizeSignatures([{ name: '', text: 'a' }]).error, /nom/);
  const big = 'data:image/png;base64,' + 'A'.repeat(220000);
  assert.match(normalizeSignatures([{ name: 'X', text: 'a', logo: big }]).error, /trop lourd/);
  assert.ok(normalizeSignatures(DEFAULT_SIGNATURES).signatures);
});

test('signature proposée selon l’enseigne du dossier, sinon la première', () => {
  const list = [
    { id: 'a', brands: [] },
    { id: 'b', brands: ['GROSBILL'] },
  ];
  assert.equal(pickSignature(list, { brand: 'Grosbill' }).id, 'b');
  assert.equal(pickSignature(list, { brand: 'CYBERTEK' }).id, 'a');
  assert.equal(pickSignature([], {}), null);
});

test('message + signature : texte simple et HTML avec logo, sans injection', () => {
  const sig = { name: 'S', text: 'Cordialement,\n{agent}', logo: PNG, logoWidth: 320 };
  const values = { agent: 'Lydia <b>' };
  assert.equal(composeText('Bonjour\n', sig, values), 'Bonjour\n\nCordialement,\nLydia <b>');
  assert.equal(composeText('Bonjour', null, values), 'Bonjour');
  const html = composeHtml('Bonjour <script>', sig, values);
  assert.ok(html.includes('Bonjour &lt;script&gt;'));
  assert.ok(html.includes('Lydia &lt;b&gt;'));
  assert.ok(html.includes('<img src="' + PNG + '"'));
  assert.ok(html.includes('width:320px'));
});
