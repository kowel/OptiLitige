import test from 'node:test';
import assert from 'node:assert/strict';
import { creditRequestMail, normalizeCreditNotify } from '../app/credit-mail.mjs';
import { normalizeCreditSettings, DEFAULT_CREDIT_SETTINGS } from '../app/credit-requests.mjs';

const record = {
  ref: 'LIT-2026-0042',
  title: 'Colis abîmé',
  customer: 'Client fictif',
  customerAccount: 'C123',
  order: 'CMD-1',
  brand: 'GROSBILL',
  type: 'Livraison endommagé',
};
const request = {
  family: 'legal',
  reason: 'Produit endommagé à la livraison',
  kind: 'partial',
  amount: 120.5,
  imputation: 'Transporteur',
  comment: 'Photos jointes',
};

test('mail de nouvelle demande d’avoir : destinataire, objet et détail de la demande', () => {
  const m = creditRequestMail(
    record,
    request,
    { name: 'Pierre Mazeaud', email: 'p.test@exemple.fr' },
    'https://outil.test/',
    'Sophie Morel',
  );
  assert.equal(m.to, 'p.test@exemple.fr');
  assert.match(m.subject, /^Nouvelle demande d’avoir – LIT-2026-0042 – 120,50/);
  assert.match(m.body, /^Bonjour Pierre,/);
  assert.match(m.body, /Montant demandé : 120,50/);
  assert.match(m.body, /Motif : Obligation légale – Produit endommagé à la livraison/);
  assert.match(m.body, /Imputation : Transporteur/);
  assert.match(m.body, /https:\/\/outil\.test\//);
  assert.match(m.body, /Sophie Morel$/);
  assert.ok(m.href.startsWith('mailto:p.test@exemple.fr?subject='));
  // Sans adresse réglée : pas d'e-mail proposé
  assert.equal(
    creditRequestMail(record, request, { name: 'Pierre Mazeaud', email: '' }, '', ''),
    null,
  );
});

test('réglage du destinataire : adresse vérifiée, gardée avec les réglages des avoirs', () => {
  assert.deepEqual(normalizeCreditNotify({ name: ' Pierre ', email: 'P@X.FR' }), {
    name: 'Pierre',
    email: 'p@x.fr',
  });
  assert.equal(normalizeCreditNotify({ email: 'pas une adresse' }), null);
  const { settings } = normalizeCreditSettings({
    ...DEFAULT_CREDIT_SETTINGS,
    notify: { name: 'Pierre Mazeaud', email: 'p@x.fr' },
  });
  assert.equal(settings.notify.email, 'p@x.fr');
  assert.match(
    normalizeCreditSettings({ ...DEFAULT_CREDIT_SETTINGS, notify: { email: 'x' } }).error,
    /invalide/,
  );
});
