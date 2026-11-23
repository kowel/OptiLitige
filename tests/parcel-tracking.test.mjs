import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TRACKING_LINKS,
  guessCarrier,
  normalizeTrackingLinks,
  trackingLinksFor,
  trackingNumbers,
} from '../app/parcel-tracking.mjs';

test('numéros de suivi extraits du champ BT', () => {
  assert.deepEqual(trackingNumbers('XN078764774FR '), ['XN078764774FR']);
  assert.deepEqual(trackingNumbers('6C20476524374 / 6C20476226766'), [
    '6C20476524374',
    '6C20476226766',
  ]);
  assert.deepEqual(trackingNumbers('XN145193992FR annulé mais parti par TNT 5948947521000351'), [
    'XN145193992FR',
    '5948947521000351',
  ]);
  assert.deepEqual(trackingNumbers('bug jaja'), []);
  assert.deepEqual(trackingNumbers(''), []);
});

test('transporteur deviné d’après la forme du numéro', () => {
  assert.equal(guessCarrier('XN078764774FR', 'TNT'), 'CHRONOPOST');
  assert.equal(guessCarrier('6C20377589328', ''), 'COLISSIMO');
  assert.equal(guessCarrier('5948947521000351', 'CHRONOPOST'), 'TNT');
  assert.equal(guessCarrier('885896350333', 'FedEx'), 'FEDEX');
  assert.equal(guessCarrier('1GMLMRVRHAYJ', 'France Express'), 'FRANCE EXPRESS');
});

test('liens de suivi d’un dossier', () => {
  const links = trackingLinksFor({ carrier: 'CHRONOPOST', bt: 'XN078764774FR' });
  assert.equal(
    links[0].url,
    'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=XN078764774FR',
  );
  const geodis = trackingLinksFor({ carrier: 'GEODIS', bt: '1G9PLLZ3ZUMT' });
  assert.equal(geodis[0].url, '');
  assert.equal(geodis[0].carrier, 'GEODIS');
});

test('adresses contrôlées avant enregistrement', () => {
  assert.deepEqual(normalizeTrackingLinks(DEFAULT_TRACKING_LINKS).links, DEFAULT_TRACKING_LINKS);
  assert.ok(normalizeTrackingLinks({ GEODIS: 'http://a.fr/{numero}' }).error);
  assert.ok(normalizeTrackingLinks({ GEODIS: 'https://a.fr/' }).error);
  assert.ok(normalizeTrackingLinks({ GEODIS: 'javascript:alert(1)//{numero}' }).error);
  assert.deepEqual(
    normalizeTrackingLinks({ geodis: ' https://a.fr/?n={numero} ', TNT: '' }).links,
    {
      GEODIS: 'https://a.fr/?n={numero}',
    },
  );
});
