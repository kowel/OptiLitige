import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findMentionQuery,
  filterMentionMembers,
  insertMention,
  reconcileMentionTokens,
  selectedMentionEmails,
} from '../app/mention-logic.mjs';
const mathieu = { name: 'Mathieu Petit', email: 'mathieu@test.example', role: 'Service Litige' },
  lea = { name: 'Léa Bernard', email: 'lea@test.example', role: 'RC' },
  disabled = { name: 'Ancien Agent', email: 'ancien@test.example', role: 'Désactivé' };
const members = [mathieu, lea, disabled];
const query = (text) => findMentionQuery(text, text.length);
test('Arrobase seule propose les agents actifs', () => {
  assert.equal(query('@').query, '');
  assert.equal(filterMentionMembers(members, '').length, 2);
});
test('La recherche affine le nom complet, dans tout ordre et sans accents', () => {
  assert.equal(filterMentionMembers(members, 'mathieu p')[0].email, mathieu.email);
  assert.equal(filterMentionMembers(members, 'petit math')[0].email, mathieu.email);
  assert.equal(filterMentionMembers(members, 'lea')[0].email, lea.email);
  assert.equal(filterMentionMembers(members, 'inconnu').length, 0);
});
test('Une adresse e-mail ordinaire ne déclenche pas les suggestions', () => {
  assert.equal(query('contact@mathieu'), null);
  assert.equal(query('Bonjour @mathieu').query, 'mathieu');
  assert.equal(query('Bonjour\n@mathieu petit').query, 'mathieu petit');
  assert.equal(query('Bonjour @mathieu\nmerci'), null);
});
test('La sélection insère le nom et conserve le compte comme destinataire', () => {
  const text = 'Bonjour @math';
  const r = insertMention(text, query(text), mathieu);
  assert.equal(r.text, 'Bonjour @Mathieu Petit ');
  assert.deepEqual(selectedMentionEmails(r.text, r.tokens, members), [mathieu.email]);
  assert.equal(findMentionQuery(r.text, r.caret, r.tokens), null);
});
test('La sélection respecte le texte après le curseur', () => {
  const text = 'Bonjour @mat, merci';
  const q = findMentionQuery(text, 'Bonjour @mat'.length);
  const r = insertMention(text, q, mathieu);
  assert.equal(r.text, 'Bonjour @Mathieu Petit, merci');
});
test('Deux mentions peuvent viser des agents différents', () => {
  const first = insertMention('@mat', query('@mat'), mathieu);
  const text = first.text + 'et @lea';
  const marked = reconcileMentionTokens(first.text, text, first.tokens);
  const second = insertMention(text, query(text), lea, marked);
  assert.deepEqual(selectedMentionEmails(second.text, second.tokens, members), [
    mathieu.email,
    lea.email,
  ]);
});
test('Plusieurs mentions de la même personne ne doublent pas les destinataires', () => {
  const first = insertMention('@mat', query('@mat'), mathieu);
  const text = first.text + '@mat';
  const second = insertMention(text, query(text), mathieu, first.tokens);
  assert.deepEqual(selectedMentionEmails(second.text, second.tokens, members), [mathieu.email]);
});
test('Supprimer ou modifier le nom retire la mention et évite une notification fantôme', () => {
  const r = insertMention('@mat', query('@mat'), mathieu);
  for (const text of ['', '@Mathieu ', '@Mathieu Petix ', '@Mathieu Petita ']) {
    const marked = reconcileMentionTokens(r.text, text, r.tokens);
    assert.deepEqual(selectedMentionEmails(text, marked, members), []);
  }
});
test('Les positions sont conservées lors des modifications autour du nom', () => {
  const r = insertMention('@mat', query('@mat'), mathieu);
  const prefix = 'Bonjour ' + r.text;
  const initial = reconcileMentionTokens(r.text, prefix, r.tokens);
  const after = prefix + 'merci';
  const marked = reconcileMentionTokens(prefix, after, initial);
  assert.deepEqual(selectedMentionEmails(after, marked, members), [mathieu.email]);
});
test('Deux agents homonymes restent identifiés par leur adresse choisie', () => {
  const other = { ...mathieu, email: 'autre@test.example' };
  const r = insertMention('@mat', query('@mat'), other);
  assert.deepEqual(selectedMentionEmails(r.text, r.tokens, [mathieu, other]), [other.email]);
});
