import test from 'node:test';
import assert from 'node:assert/strict';
// Serveur de test (copie de la base, scripts/serveur-tests.mjs) : jamais la base de référence
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5174';
test('API locale : identité, création, transitions, commentaires et import sans doublon', async () => {
  const anonymous = await fetch(origin + '/api/data');
  assert.equal(anonymous.status, 401);
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const get = async () => {
    const r = await fetch(origin + '/api/data', { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    return r.json();
  };
  const post = async (p) => {
    const r = await fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    return { status: r.status, body: await r.json() };
  };
  let d = await get();
  // Repères de montant : valeurs par défaut, enregistrement, contrôle, retour aux défauts
  assert.deepEqual(d.amountAlerts, { orange: 2000, red: 7500 });
  assert.equal(
    (await post({ action: 'amount-alerts', alerts: { orange: 9000, red: 100 } })).status,
    400,
  );
  assert.equal(
    (await post({ action: 'amount-alerts', alerts: { orange: 1000, red: 5000 } })).status,
    200,
  );
  assert.deepEqual((await get()).amountAlerts, { orange: 1000, red: 5000 });
  await post({ action: 'amount-alerts', alerts: { orange: 2000, red: 7500 } });
  d = await get();
  assert.ok(d.catalogs.brands.includes('MAGASIN'));
  assert.ok(d.catalogs.stores.includes('NANTES'));
  assert.ok(d.types.includes('Inversion'));
  const created = await post({
    action: 'create',
    record: {
      title: 'Test API local',
      customer: 'Fictif',
      customerAccount: 'C-TEST',
      order: 'LOCAL-TEST',
      amount: 1299.9,
      origin: 'Transport',
      type: 'Inversion',
      brand: 'GROSBILL',
      productType: 'PC',
      description: 'Test technique local uniquement.',
    },
  });
  assert.equal(created.status, 200);
  let data = await get(),
    r = data.records.find((r) => r.id === created.body.id);
  assert.equal(r.brand, 'GROSBILL');
  assert.equal(r.amount, 1299.9);
  // Demandeur : l'agent connecté par défaut, et uniquement un compte actif de l'équipe
  assert.equal(r.requesterEmail, d.me.email.toLowerCase());
  assert.equal(r.requester, d.me.name);
  const unknownRequester = await post({
    action: 'create',
    record: {
      title: 'Demandeur inconnu',
      customer: 'Fictif',
      customerAccount: 'C-TEST',
      order: 'LOCAL-REQ',
      amount: 1,
      origin: 'Interne',
      type: 'Inversion',
      brand: 'GROSBILL',
      productType: 'PC',
      description: 'Test demandeur.',
      requesterEmail: 'inconnu@exemple.fr',
      requester: 'Inconnu',
    },
  });
  assert.equal(unknownRequester.status, 400);
  // Enseigne « MAGASIN » : magasin obligatoire, conservé avec le dossier
  const storeRecord = {
    title: 'Litige magasin',
    customer: 'Fictif',
    customerAccount: 'C-TEST',
    order: 'LOCAL-MAG',
    amount: 1,
    origin: 'Interne',
    type: 'Inversion',
    brand: 'MAGASIN',
    productType: 'PC',
    description: 'Test magasin.',
  };
  assert.equal((await post({ action: 'create', record: storeRecord })).status, 400);
  const withStore = await post({ action: 'create', record: { ...storeRecord, store: 'NANTES' } });
  assert.equal(withStore.status, 200);
  assert.equal((await get()).records.find((x) => x.id === withStore.body.id).store, 'NANTES');
  // Décision du transporteur : seules les valeurs prévues sont acceptées
  const badDecision = await post({
    ...r,
    action: 'update',
    status: 'Pris en charge',
    carrierDecision: 'Peut-être',
  });
  assert.equal(badDecision.status, 400);
  let update = await post({
    ...r,
    action: 'update',
    carrierDecision: 'Partiel',
    status: 'Pris en charge',
    creditNumber: 'AV-AUTO',
    creditIssued: false,
    credit: 12.34,
    compensation: 0,
  });
  assert.equal(update.status, 200);
  assert.equal((await get()).records.find((x) => x.id === r.id).carrierDecision, 'Partiel');
  // Un commentaire envoyé avec une version dépassée (un collègue a modifié le dossier entre-temps)
  // est quand même ajouté : il ne remplace rien
  const stale = await post({
    action: 'comment',
    id: r.id,
    version: r.version,
    text: 'Commentaire malgré une modification',
    mentions: [],
  });
  assert.equal(stale.status, 200);
  // Un traitement ouvert AVANT le commentaire d'un collègue s'enregistre quand même
  // (seul le contenu compte, pas les commentaires)…
  const opened = (await get()).records.find((x) => x.id === r.id);
  const chat = await post({
    action: 'comment',
    id: r.id,
    version: opened.version,
    text: 'Commentaire d’un collègue pendant la saisie',
    mentions: [],
  });
  assert.equal(chat.status, 200);
  const afterComment = await post({ ...opened, action: 'update', compensation: 0 });
  assert.equal(afterComment.status, 200);
  // …mais un deuxième enregistrement basé sur la même ouverture est refusé : le contenu a changé
  const staleUpdate = await post({ ...opened, action: 'update', compensation: 0 });
  assert.equal(staleUpdate.status, 409);
  data = await get();
  r = data.records.find((x) => x.id === r.id);
  assert.ok(r.takenAt);
  assert.equal(r.creditNumber, 'AV-AUTO');
  assert.equal(r.credit, 12.34);
  assert.equal(r.creditIssued, true);
  assert.match(r.creditCreated, /^\d{4}-\d{2}-\d{2}$/);
  const noResult = await post({
    ...r,
    action: 'update',
    status: 'Résolu',
    verdict: 'Avéré',
    reason: 'Inversion',
    credit: 49.9,
    compensation: 35,
  });
  assert.equal(noResult.status, 400);
  // Imputation obligatoire à la clôture (Interne ou Transporteur)
  const noImputation = await post({
    ...r,
    action: 'update',
    status: 'Résolu',
    verdict: 'Avéré',
    reason: 'Inversion',
    outcome: 'Livraison non conforme',
    credit: 49.9,
    compensation: 35,
  });
  assert.equal(noImputation.status, 400);
  const resolved = await post({
    ...r,
    action: 'update',
    status: 'Résolu',
    verdict: 'Avéré',
    reason: 'Inversion',
    outcome: 'Livraison non conforme',
    imputation: 'Transporteur',
    creditNumber: 'AV-LOCAL-TEST',
    creditCreated: '2026-10-23',
    creditIssued: false,
    credit: 49.9,
    compensation: 35,
  });
  assert.equal(resolved.status, 200);
  data = await get();
  r = data.records.find((x) => x.id === r.id);
  assert.ok(r.closed);
  assert.equal(r.imputation, 'Transporteur');
  assert.equal(r.credit, 49.9);
  assert.equal(r.creditIssued, true);
  assert.equal(r.creditNumber, 'AV-LOCAL-TEST');
  assert.equal(r.creditCreated, '2026-10-23');
  const corrected = await post({ ...r, action: 'update', creditCreated: '2026-10-22' });
  assert.equal(corrected.status, 200);
  data = await get();
  r = data.records.find((x) => x.id === r.id);
  assert.equal(r.creditCreated, '2026-10-22');
  const { creditCreated: _omitDate, ...withoutDate } = r; // creditCreated volontairement retiré
  assert.equal((await post({ ...withoutDate, action: 'update' })).status, 200);
  data = await get();
  r = data.records.find((x) => x.id === r.id);
  assert.equal(r.creditCreated, '2026-10-22');
  const record = {
    title: 'Test import serveur',
    status: 'Résolu',
    origin: 'Transport',
    type: 'Inversion',
    created: '2025-08-21T00:00:00.000Z',
    closed: '2025-08-24T00:00:00.000Z',
    reopened: [],
    amount: 2249.93,
    credit: 0,
    compensation: 0,
    sourceList: 'TEST-' + created.body.id,
    externalId: '2184',
    sourceData: { 'N° de CDE': 6172134, Enseigne: 'GROSBILL' },
    brand: 'GROSBILL',
    productType: 'PC',
  };
  const imported = await post({ action: 'import', fileName: 'test.xlsx', records: [record] });
  assert.equal(imported.status, 200);
  assert.equal(imported.body.imported, 1);
  const duplicate = await post({ action: 'import', fileName: 'test.xlsx', records: [record] });
  assert.equal(duplicate.body.skipped, 1);
  assert.equal(duplicate.body.imported, 0);
  const invalid = await post({
    action: 'import',
    records: [{ ...record, closed: '2025-08-01T00:00:00.000Z' }],
  });
  assert.equal(invalid.status, 400);
  // Le demandeur devient propriétaire s'il a un compte (nom sans tenir compte de la casse)
  assert.equal(
    (
      await post({
        action: 'member',
        name: 'Agent Import Test',
        email: 'agent.import@exemple.test',
        role: 'RC',
      })
    ).status,
    200,
  );
  const owned = await post({
    action: 'import',
    fileName: 'test.xlsx',
    records: [{ ...record, externalId: '2185', requester: 'AGENT import test', priority: 'Haute' }],
  });
  assert.equal(owned.body.imported, 1);
  const ownedRecord = (await get()).records.find(
    (x) => x.sourceList === record.sourceList && x.sourceId === '2185',
  );
  assert.equal(ownedRecord.creator, 'agent.import@exemple.test');
  assert.equal(ownedRecord.requesterEmail, 'agent.import@exemple.test');
  assert.equal(ownedRecord.priority, 'Haute');
  // Demandeur sans compte à l'import : rattaché quand un admin ajoute son compte
  await post({
    action: 'import',
    fileName: 'test.xlsx',
    records: [{ ...record, externalId: '2189', requester: 'Futur Agent Ëssai' }],
  });
  const waiting = (await get()).records.find(
    (x) => x.sourceList === record.sourceList && x.sourceId === '2189',
  );
  assert.equal(waiting.requesterEmail || '', '');
  const futur = await post({
    action: 'member',
    name: 'FUTUR agent essai',
    email: 'futur.agent@exemple.test',
    role: 'RC',
  });
  assert.equal(futur.status, 200);
  assert.ok(futur.body.claimed >= 1);
  const claimedRecord = (await get()).records.find((x) => x.id === waiting.id);
  assert.equal(claimedRecord.requesterEmail, 'futur.agent@exemple.test');
  assert.equal(claimedRecord.creator, 'futur.agent@exemple.test');
  assert.equal(claimedRecord.version, waiting.version + 1);
  // Conclusion envoyée par la requête jamais reprise telle quelle : déduite du résultat
  const forged = await post({
    action: 'import',
    fileName: 'test.xlsx',
    records: [
      {
        ...record,
        externalId: '2186',
        outcome: 'Livraison conforme',
        resolution: { verdict: 'Avéré', reason: 'forcé' },
      },
      { ...record, externalId: '2187', resolution: { verdict: 'N’importe quoi', reason: 'x' } },
    ],
  });
  assert.equal(forged.body.imported, 2);
  const after = (await get()).records.filter((x) => x.sourceList === record.sourceList);
  assert.equal(after.find((x) => x.sourceId === '2186').resolution.verdict, 'Non avéré');
  assert.equal(
    after.find((x) => x.sourceId === '2187').resolution.verdict,
    'Non renseigné (import)',
  );
  // Réimport sous un autre nom de liste : même ID SharePoint et même ouverture = déjà présent
  const renamed = await post({
    action: 'import',
    fileName: 'test.xlsx',
    records: [
      { ...record, externalId: '2185', sourceList: record.sourceList + '-autre-nom' },
      { ...record, externalId: '2188', sourceList: record.sourceList + '-autre-nom' },
    ],
  });
  assert.equal(renamed.body.imported, 1);
  assert.equal(renamed.body.skipped, 1);
  // Correction par un responsable : montant et n° de commande, historique avant → après
  const edited = await post({
    action: 'edit-info',
    id: ownedRecord.id,
    version: ownedRecord.version,
    info: { disputeValue: 2434.97, order: 'LOCAL-CORRIGE' },
  });
  assert.equal(edited.status, 200);
  const staleEdit = await post({
    action: 'edit-info',
    id: ownedRecord.id,
    version: ownedRecord.version,
    info: { disputeValue: 1 },
  });
  assert.equal(staleEdit.status, 409); // version périmée : modifié entre-temps
  const { record: editedRecord } = await fetch(
    origin + '/api/data?id=' + encodeURIComponent(ownedRecord.id),
    { headers: { Cookie: cookie } },
  ).then((x) => x.json());
  // Montant concerné par le litige corrigé ; le montant de commande (repris) ne change pas
  assert.equal(editedRecord.disputeValue, 2434.97);
  assert.equal(editedRecord.amount, 2249.93);
  assert.equal(editedRecord.order, 'LOCAL-CORRIGE');
  assert.match(
    editedRecord.history.at(-1).text,
    /Montant concerné par le litige : .* → 2\s434,97\s€/,
  );
  ownedRecord.version = editedRecord.version;
  // Reprise des commentaires SharePoint : auteur et date d'origine, sans doublon
  const spComments = [
    {
      sourceKey: 'sp-comment-1',
      author: 'Agent SharePoint',
      date: '2025-08-22T10:00:00Z',
      text: 'Commentaire d’origine',
    },
  ];
  const resumed = await post({
    action: 'import-comments',
    id: ownedRecord.id,
    comments: spComments,
  });
  assert.equal(resumed.body.added, 1);
  const again = await post({ action: 'import-comments', id: ownedRecord.id, comments: spComments });
  assert.deepEqual([again.body.added, again.body.skipped], [0, 1]);
  // Relecture corrigée : texte mis à jour (entités SharePoint décodées), pas de doublon
  const fixed = await post({
    action: 'import-comments',
    id: ownedRecord.id,
    comments: [{ ...spComments[0], text: 'Bonjour @Lydia &#58; &quot;OK&quot;' }],
  });
  assert.deepEqual([fixed.body.added, fixed.body.updated], [0, 1]);
  const notImported = await post({
    action: 'import-comments',
    id: created.body.id,
    comments: spComments,
  });
  assert.equal(notImported.status, 400);
  const { record: resumedRecord } = await fetch(
    origin + '/api/data?id=' + encodeURIComponent(ownedRecord.id),
    { headers: { Cookie: cookie } },
  ).then((x) => x.json());
  const kept = resumedRecord.comments.find((c) => c.sourceKey === 'sp-comment-1');
  assert.equal(kept.author, 'Agent SharePoint (SharePoint)');
  assert.equal(kept.text, 'Bonjour @Lydia : "OK"');
  assert.equal(resumedRecord.comments.filter((c) => c.sourceKey === 'sp-comment-1').length, 1);
  assert.equal(kept.date, '2025-08-22T10:00:00.000Z');
  // Pièce jointe reprise : auteur d'origine, doublon ignoré
  const spFile = () => {
    const body = new FormData();
    body.append('id', ownedRecord.id);
    body.append('file', new Blob(['%PDF-1.4 sp']), 'bon.pdf');
    body.append('sourceKey', 'sp-2185/bon.pdf');
    body.append('sourceAuthor', 'SharePoint');
    return fetch(origin + '/api/attachments', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin },
      body,
    }).then((x) => x.json());
  };
  assert.equal((await spFile()).attachment.author, 'SharePoint');
  assert.equal((await spFile()).skipped, true);
  // Photo de téléphone de plusieurs Mo (la limite par défaut de 1 Mo refusait les envois : 413)
  const big = new FormData();
  big.append('id', ownedRecord.id);
  big.append('file', new Blob([new Uint8Array(4 * 1024 * 1024)]), 'photo-telephone.jpg');
  const bigUpload = await fetch(origin + '/api/attachments', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: origin },
    body: big,
  });
  assert.equal(bigUpload.status, 200);
  // Liste allégée : pas de champs lourds ; le détail complet se charge par identifiant
  data = await get();
  const listed = data.records.find((x) => x.sourceList === record.sourceList);
  assert.equal(listed.lite, true);
  for (const heavy of ['sourceData', 'history', 'transportMessages', 'description'])
    assert.equal(listed[heavy], undefined, heavy + ' ne doit pas être dans la liste');
  assert.ok(Array.isArray(listed.comments));
  const full = await fetch(origin + '/api/data?id=' + encodeURIComponent(listed.id), {
    headers: { Cookie: cookie },
  });
  assert.equal(full.status, 200);
  const { record: detail } = await full.json();
  assert.equal(detail.version, listed.version);
  assert.deepEqual(detail.sourceData, record.sourceData);
  assert.ok(detail.history.length >= 2);
  assert.equal(
    (await fetch(origin + '/api/data?id=absent', { headers: { Cookie: cookie } })).status,
    404,
  );
  assert.equal((await fetch(origin + '/api/data?id=' + listed.id)).status, 401);
});

test('API locale : journal des accès', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const post = (p) =>
    fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
  const email = 'journal-' + Date.now() + '@test.example';
  assert.equal(
    (await post({ action: 'member', email, name: 'Agent test', role: 'RC' })).status,
    200,
  );
  assert.equal(
    (await post({ action: 'member', email, name: 'Agent test', role: 'Désactivé' })).status,
    200,
  );
  // Même valeur : aucune nouvelle ligne
  assert.equal(
    (await post({ action: 'member', email, name: 'Agent test', role: 'Désactivé' })).status,
    200,
  );
  const d = await fetch(origin + '/api/data', { headers: { Cookie: cookie } }).then((r) =>
    r.json(),
  );
  const lines = d.accessLog.filter((l) => l.email === email);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].after.role, 'Désactivé');
  assert.equal(lines[0].before.role, 'RC');
  assert.equal(lines[1].before, null);
  assert.equal(lines[0].by, d.me.email);
});

test('API locale : délais (SLA) et rôle SAV', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const post = (p) =>
    fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
  const get = () =>
    fetch(origin + '/api/data', { headers: { Cookie: cookie } }).then((r) => r.json());
  const before = (await get()).sla;
  assert.ok(Array.isArray(before) && before.length >= 1);
  const rules = [
    ...before,
    { id: 'rc', label: 'Réponse de la RC', kind: 'status', status: 'En attente RC', hours: 48 },
  ];
  assert.equal((await post({ action: 'sla', sla: rules })).status, 200);
  const saved = (await get()).sla;
  assert.equal(saved.at(-1).label, 'Réponse de la RC');
  assert.equal(saved.at(-1).enabled, true);
  assert.equal(
    (
      await post({
        action: 'sla',
        sla: [{ label: 'X', kind: 'status', status: 'Résolu', hours: 1 }],
      })
    ).status,
    400,
  );
  assert.equal((await post({ action: 'sla', sla: before })).status, 200); // remise en état
  // Le rôle SAV est accepté ; un dossier créé note le début de son statut
  const sav = 'sav-' + Date.now() + '@test.example';
  assert.equal(
    (await post({ action: 'member', email: sav, name: 'SAV test', role: 'SAV' })).status,
    200,
  );
  const created = await post({
    action: 'create',
    record: {
      title: 'Test SLA',
      customer: 'Fictif',
      customerAccount: 'C-TEST',
      order: 'LOCAL-SLA',
      amount: 1,
      origin: 'Interne',
      type: 'Inversion',
      brand: 'GROSBILL',
      productType: 'PC',
      description: 'Test local SLA.',
    },
  }).then((r) => r.json());
  const r = (await get()).records.find((x) => x.id === created.id);
  assert.ok(r.statusSince);
  assert.equal(r.statusSince, r.created);
});

test('API locale : notifications par catégorie (attribution, lecture)', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const post = (p) =>
    fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
  const get = () =>
    fetch(origin + '/api/data', { headers: { Cookie: cookie } }).then((r) => r.json());
  const { id } = await post({
    action: 'create',
    record: {
      title: 'Test attribution',
      customer: 'Fictif',
      customerAccount: 'C-TEST',
      order: 'LOCAL-ATTR',
      amount: 1,
      origin: 'Interne',
      type: 'Inversion',
      brand: 'GROSBILL',
      productType: 'PC',
      description: 'Test local attribution.',
    },
  }).then((r) => r.json());
  let d = await get();
  let r = d.records.find((x) => x.id === id);
  assert.equal(r.assignedAt, undefined);
  const updated = await post({
    ...r,
    action: 'update',
    status: 'Pris en charge',
    assignee: d.me.email,
    compensation: 0,
  });
  assert.equal(updated.status, 200);
  d = await get();
  r = d.records.find((x) => x.id === id);
  assert.ok(r.assignedAt);
  const key = 'assign:' + id + ':' + r.assignedAt;
  assert.equal((await post({ action: 'read-alert', keys: [key] })).status, 200);
  assert.ok((await get()).readAlertKeys.includes(key));
  assert.equal((await post({ action: 'read-alert', keys: ['autre:' + id] })).status, 400);
  assert.equal((await post({ action: 'read-alert', keys: [] })).status, 400);
});

test('API locale : pièces jointes (envoi, téléchargement, suppression)', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const send = (method, body, extra = {}) =>
    fetch(origin + '/api/attachments', {
      method,
      headers: { Cookie: cookie, Origin: origin, ...extra },
      body,
    });
  const created = await fetch(origin + '/api/data', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      record: {
        title: 'Test pièces jointes',
        customer: 'Fictif',
        customerAccount: 'C-TEST',
        order: 'LOCAL-PJ',
        amount: 10,
        origin: 'Transport',
        type: 'Inversion',
        brand: 'GROSBILL',
        productType: 'PC',
        description: 'Test local des pièces jointes.',
      },
    }),
  }).then((r) => r.json());
  const id = created.id;
  const form = (name, content, type = 'application/octet-stream') => {
    const f = new FormData();
    f.append('id', id);
    f.append('file', new File([content], name, { type }));
    return f;
  };
  // Envoi accepté, avec un nom accentué ; le type déclaré (text/html) est ignoré
  const sent = await send(
    'POST',
    form('Réclamation transporteur.pdf', '%PDF-1.4 test', 'text/html'),
  );
  assert.equal(sent.status, 200);
  const { attachment } = await sent.json();
  assert.equal(attachment.name, 'Réclamation transporteur.pdf');
  // Format refusé, sans origine, sans connexion
  assert.equal((await send('POST', form('page.html', '<script>'))).status, 400);
  assert.equal(
    (
      await fetch(origin + '/api/attachments', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: form('a.pdf', 'x'),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(origin + '/api/attachments', {
        method: 'POST',
        headers: { Origin: origin },
        body: form('a.pdf', 'x'),
      })
    ).status,
    401,
  );
  // Le dossier liste la pièce jointe et l'historique la mentionne
  const detail = await fetch(origin + '/api/data?id=' + id, { headers: { Cookie: cookie } }).then(
    (r) => r.json(),
  );
  assert.equal(detail.record.attachments.length, 1);
  assert.ok(
    detail.record.history.some(
      (h) => h.text === 'Pièce jointe ajoutée : Réclamation transporteur.pdf',
    ),
  );
  // Téléchargement : contenu identique, type imposé, téléchargement forcé pour un PDF
  const url = origin + '/api/attachments?id=' + id + '&att=' + attachment.id;
  const file = await fetch(url, { headers: { Cookie: cookie } });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.match(
    file.headers.get('content-disposition'),
    /^attachment;.*filename\*=UTF-8''R%C3%A9clamation/,
  );
  assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await file.text(), '%PDF-1.4 test');
  assert.equal((await fetch(url)).status, 401);
  assert.equal(
    (
      await fetch(origin + '/api/attachments?id=' + id + '&att=absent', {
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );
  // Suppression : fichier et métadonnées retirés
  const removed = await send('DELETE', JSON.stringify({ id, att: attachment.id }), {
    'Content-Type': 'application/json',
  });
  assert.equal(removed.status, 200);
  assert.equal((await fetch(url, { headers: { Cookie: cookie } })).status, 404);
  const after = await fetch(origin + '/api/data?id=' + id, { headers: { Cookie: cookie } }).then(
    (r) => r.json(),
  );
  assert.equal(after.record.attachments.length, 0);
  assert.ok(after.record.history.some((h) => h.text.startsWith('Pièce jointe supprimée')));
});

test('API locale : demande d’avoir (demande, validation, émission)', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const post = (p) =>
    fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
  const detail = (id) =>
    fetch(origin + '/api/data?id=' + id, { headers: { Cookie: cookie } })
      .then((r) => r.json())
      .then((d) => d.record);
  const { id } = await post({
    action: 'create',
    record: {
      title: 'Test avoir',
      customer: 'Fictif',
      customerAccount: 'C-TEST',
      order: 'LOCAL-AVOIR',
      amount: 400,
      origin: 'Transport',
      type: 'Livraison endommagé',
      brand: 'GROSBILL',
      productType: 'PC',
      description: 'Test local avoir.',
    },
  }).then((r) => r.json());
  const settings = (
    await fetch(origin + '/api/data', { headers: { Cookie: cookie } }).then((r) => r.json())
  ).creditSettings;
  assert.ok(settings.reasons.legal.length);
  const request = {
    family: 'legal',
    reason: settings.reasons.legal[0],
    kind: 'partial',
    imputation: settings.imputations[0],
    amount: 120.5,
    comment: 'Test',
  };
  assert.equal(
    (await post({ action: 'credit-request', id, request: { ...request, amount: -1 } })).status,
    400,
  );
  assert.equal((await post({ action: 'credit-request', id, request })).status, 200);
  let r = await detail(id);
  const c = r.credits[0];
  assert.equal(c.status, 'requested');
  // Une version périmée n'empêche pas de faire avancer l'avoir
  assert.equal(
    (
      await post({
        action: 'credit-decision',
        id,
        creditId: c.id,
        decision: 'accept',
        amount: 100,
        version: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post({
        action: 'credit-issue',
        id,
        creditId: c.id,
        number: 'AV-LOCAL-1',
        date: '2026-11-06',
      })
    ).status,
    200,
  );
  r = await detail(id);
  assert.equal(r.credits[0].status, 'issued');
  assert.equal(r.creditNumber, 'AV-LOCAL-1');
  assert.equal(r.credit, 100);
  assert.ok(r.history.some((h) => h.text.startsWith('Avoir émis dans l’ERP')));
  assert.equal((await post({ action: 'credit-cancel', id, creditId: c.id })).status, 403);
  assert.equal(
    (await post({ action: 'credit-settings', settings: { ...settings, imputations: [] } })).status,
    400,
  );
  assert.equal((await post({ action: 'credit-settings', settings })).status, 200);
});

test('API locale : vues partagées par service', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const post = (p) =>
    fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
  const get = () =>
    fetch(origin + '/api/data', { headers: { Cookie: cookie } }).then((r) => r.json());
  const name = 'Vue test ' + Date.now();
  const view = {
    name,
    filters: { q: '', status: 'Tous', period: '99999', adv: { carrier: 'DPD', min: '500' } },
  };
  const added = await post({ action: 'view-add', view });
  assert.equal(added.status, 200);
  const d = await get();
  const saved = d.savedViews.find((v) => v.name === name);
  assert.ok(saved);
  assert.equal(saved.createdBy, d.me.email);
  assert.equal(saved.filters.adv.min, '500');
  // Même nom refusé dans le service ; nom vide refusé
  assert.equal((await post({ action: 'view-add', view })).status, 400);
  assert.equal((await post({ action: 'view-add', view: { name: '' } })).status, 400);
  assert.equal((await post({ action: 'view-delete', id: saved.id })).status, 200);
  assert.ok(!(await get()).savedViews.some((v) => v.id === saved.id));
});

test('API locale : suppression d’un dossier par un admin', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const post = (p) =>
    fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
  const get = () =>
    fetch(origin + '/api/data', { headers: { Cookie: cookie } }).then((r) => r.json());
  const created = await post({
    action: 'create',
    record: {
      title: 'Dossier à supprimer',
      customer: 'Fictif',
      customerAccount: 'C-TEST',
      order: 'LOCAL-SUPPR',
      amount: 10,
      origin: 'Transport',
      type: 'Inversion',
      brand: 'GROSBILL',
      productType: 'PC',
      description: 'Test technique local uniquement.',
    },
  });
  assert.equal(created.status, 200);
  const { id } = await created.json();
  assert.ok((await get()).records.some((r) => r.id === id));
  assert.equal((await post({ action: 'record-delete', id })).status, 200);
  assert.ok(!(await get()).records.some((r) => r.id === id));
  // Déjà supprimé, ou identifiant absent : introuvable
  assert.equal((await post({ action: 'record-delete', id })).status, 404);
  assert.equal((await post({ action: 'record-delete' })).status, 404);
});

test('API locale : analyse des relances au Service Litige (admin)', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const res = await fetch(origin + '/api/data?part=relances', { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.rows));
  // Sans session : refusé
  assert.notEqual((await fetch(origin + '/api/data?part=relances')).status, 200);
});

test('API locale : expéditions (outil d’expédition et saisie responsable)', async () => {
  const token = 'jeton-local-de-test-expeditions-0001'; // .dev.vars (local uniquement)
  const send = (body, auth = 'Bearer ' + token) =>
    fetch(origin + '/api/shipments', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal((await send({ entries: [] }, 'Bearer mauvais-jeton')).status, 401);
  assert.equal(
    (await send({ entries: [{ month: '2026-13', carrier: 'TNT', count: 1 }] })).status,
    400,
  );
  const ok = await send({
    source: 'ERP (test)',
    entries: [{ month: '2000-01', carrier: 'Colissimo', count: 1234 }],
  });
  assert.equal(ok.status, 200);
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const get = () =>
    fetch(origin + '/api/data', { headers: { Cookie: cookie } }).then((r) => r.json());
  let d = await get();
  assert.equal(d.shipments['2000-01'].COLISSIMO, 1234);
  assert.equal(d.shipmentsInfo.source, 'ERP (test)');
  // Plus de saisie à la main : l'action n'existe plus, les chiffres restent ceux reçus
  const manual = await fetch(origin + '/api/data', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'shipments',
      entries: [{ month: '2000-01', carrier: 'TNT', count: 50 }],
    }),
  });
  assert.notEqual(manual.status, 200);
  d = await get();
  assert.deepEqual(d.shipments['2000-01'], { COLISSIMO: 1234 });
});

test('API locale : listes métier (ajout, renommage dans les anciens dossiers, retrait)', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const get = () =>
    fetch(origin + '/api/data', { headers: { Cookie: cookie } }).then((r) => r.json());
  const post = async (p) => {
    const r = await fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    return { status: r.status, body: await r.json() };
  };
  const before = await get();
  const original = before.types;
  const tag = 'TEST-TYPE-' + Date.now();
  // Ajout d'une valeur de test, dossier de test qui l'utilise
  assert.equal(
    (await post({ action: 'list-update', list: 'types', values: [...original, tag] })).status,
    200,
  );
  const created = await post({
    action: 'create',
    record: {
      title: 'Test liste',
      customer: 'Fictif',
      customerAccount: 'C-TEST',
      order: 'LOCAL-LISTE',
      amount: 1,
      origin: 'Interne',
      type: tag,
      brand: 'GROSBILL',
      productType: 'PC',
      description: 'Test listes.',
    },
  });
  assert.equal(created.status, 200);
  // Renommage appliqué aux anciens dossiers : seul le dossier de test porte cette valeur
  const renamed = await post({
    action: 'list-update',
    list: 'types',
    values: [...original, tag + '-B'],
    renames: [{ from: tag, to: tag + '-B' }],
    applyToRecords: true,
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.renamed, 1);
  const { record } = await fetch(origin + '/api/data?id=' + created.body.id, {
    headers: { Cookie: cookie },
  }).then((r) => r.json());
  assert.equal(record.type, tag + '-B');
  assert.match(record.history.at(-1).text, /renommé/);
  // Valeur verrouillée : refusée ; puis retour à la liste d'origine
  const stages = before.catalogs.carrierStages;
  assert.equal(
    (await post({ action: 'list-update', list: 'carrierStages', values: stages.slice(1) })).status,
    400,
  );
  assert.equal(
    (await post({ action: 'list-update', list: 'types', values: original })).status,
    200,
  );
  assert.deepEqual((await get()).types, original);
});

test('API locale : adresse partagée (profils), compte client obligatoire, inversion prioritaire', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const call = async (p, extra = '') => {
    const headers = { Cookie: cookie + extra, Origin: origin, 'Content-Type': 'application/json' };
    const r = p
      ? await fetch(origin + '/api/data', { method: 'POST', headers, body: JSON.stringify(p) })
      : await fetch(origin + '/api/data', { headers });
    return { status: r.status, body: await r.json() };
  };
  const me = (await call()).body.me;
  const email = me.account || me.email;
  try {
    // Profils : au moins deux, puis choix par cookie
    assert.equal((await call({ action: 'member-profiles', email, profiles: 'Seul' })).status, 400);
    assert.equal(
      (await call({ action: 'member-profiles', email, profiles: 'Aurélien, Lydia' })).status,
      200,
    );
    const asked = (await call()).body;
    assert.deepEqual(asked.me.profiles, ['Aurélien', 'Lydia']);
    assert.equal(asked.me.profile, undefined);
    const lydia = (await call(null, '; optilitige_profil=' + encodeURIComponent('Lydia'))).body;
    assert.equal(lydia.me.name, 'Lydia');
    assert.equal(lydia.me.email, email + '#lydia');
    assert.ok(lydia.members.some((m) => m.email === email + '#aurélien' && m.name === 'Aurélien'));
    assert.ok(lydia.accounts.some((m) => m.email === email));
    // Création au nom du profil : compte client obligatoire, nom facultatif
    const base = {
      title: 'Test profil',
      order: 'LOCAL-PROFIL-' + Date.now(),
      description: 'Test',
      type: 'Inversion',
      origin: 'Interne',
      brand: 'CYBERTEK',
      productType: 'PC',
      disputeValue: 10,
    };
    const noAccount = await call({ action: 'create', record: base }, '; optilitige_profil=Lydia');
    assert.equal(noAccount.status, 400);
    const created = await call(
      { action: 'create', record: { ...base, customerAccount: 'C0042' } },
      '; optilitige_profil=Lydia',
    );
    assert.equal(created.status, 200);
    const after = (await call(null, '; optilitige_profil=Lydia')).body;
    const rec = after.records.find((r) => r.id === created.body.id);
    assert.equal(rec.customerAccount, 'C0042');
    assert.equal(rec.customer, 'Non renseigné');
    assert.equal(rec.creator, email + '#lydia');
    // Agir sans avoir choisi de profil : refusé (rien ne part au nom de la boîte)
    const noProfile = await call({ action: 'comment', id: rec.id, text: 'x', mentions: [] });
    assert.equal(noProfile.status, 428);
    // Mentionner un profil de l'adresse partagée (@Aurélien) : accepté
    const mention = await call(
      { action: 'comment', id: rec.id, text: '@Aurélien à voir', mentions: [email + '#aurélien'] },
      '; optilitige_profil=Lydia',
    );
    assert.equal(mention.status, 200);
  } finally {
    await call({ action: 'member-profiles', email, profiles: '' }, '; optilitige_profil=Lydia');
  }
  assert.equal((await call()).body.me.profiles, undefined);
});

test('API locale : espace Contentieux (saisie, liaison au dossier, version, suppression)', async () => {
  const login = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const post = (p) =>
    fetch(origin + '/api/data', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
  const get = () =>
    fetch(origin + '/api/data', { headers: { Cookie: cookie } }).then((r) => r.json());
  const order = 'LOCAL-CT-' + Date.now();
  const dossier = await post({
    action: 'create',
    record: {
      title: 'Test contentieux',
      customerAccount: 'C-CT-TEST',
      order,
      disputeValue: 10,
      origin: 'Interne',
      type: 'Inversion',
      brand: 'GROSBILL',
      productType: 'PC',
      description: 'Test local contentieux.',
    },
  }).then((r) => r.json());
  const input = {
    receivedAt: '2026-11-10',
    kind: 'Médiation',
    customerAccount: 'C-CT-TEST',
    order,
    subject: 'Transporteur',
    subSubject: 'Colis perdu',
  };
  // Saisie incomplète refusée
  assert.equal(
    (await post({ action: 'contentieux-save', contentieux: { ...input, kind: '' } })).status,
    400,
  );
  const saved = await post({ action: 'contentieux-save', contentieux: input }).then((r) =>
    r.json(),
  );
  let c = (await get()).contentieux.find((x) => x.id === saved.id);
  assert.match(c.ref, /^CT-\d{4}-/);
  assert.equal(c.status, 'À traiter');
  // Liaison acceptée au dossier de la même commande
  assert.equal(
    (
      await post({
        action: 'contentieux-link',
        id: c.id,
        version: c.version,
        dossierId: dossier.id,
      })
    ).status,
    200,
  );
  c = (await get()).contentieux.find((x) => x.id === saved.id);
  assert.equal(c.dossierId, dossier.id);
  assert.match(c.history.at(-1).text, /^Relié au dossier litige LIT-/);
  // Version périmée : refusée
  assert.equal(
    (
      await post({
        action: 'contentieux-save',
        id: c.id,
        version: c.version - 1,
        contentieux: { ...input, status: 'Répondu' },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post({
        action: 'contentieux-save',
        id: c.id,
        version: c.version,
        contentieux: { ...input, status: 'Répondu', fees: '5.86' },
      })
    ).status,
    200,
  );
  c = (await get()).contentieux.find((x) => x.id === saved.id);
  assert.equal(c.fees, 5.86);
  // Pièces jointes du contentieux : ajout sans changer la version de la fiche ouverte
  const pj = new FormData();
  pj.append('id', c.id);
  pj.append('ct', '1');
  pj.append('file', new Blob(['%PDF-1.4 ct']), 'courrier-recommande.pdf');
  const upload = await fetch(origin + '/api/attachments', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: origin },
    body: pj,
  }).then((r) => r.json());
  assert.equal(upload.attachment.name, 'courrier-recommande.pdf');
  const file = await fetch(
    origin + '/api/attachments?id=' + c.id + '&att=' + upload.attachment.id + '&ct=1',
    { headers: { Cookie: cookie } },
  );
  assert.equal(file.status, 200);
  assert.equal(await file.text(), '%PDF-1.4 ct');
  // Pas de pièce d'un contentieux lue comme celle d'un dossier litige
  assert.equal(
    (
      await fetch(origin + '/api/attachments?id=' + c.id + '&att=' + upload.attachment.id, {
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );
  // La fiche ouverte avant l'ajout s'enregistre et garde la pièce jointe
  assert.equal(
    (
      await post({
        action: 'contentieux-save',
        id: c.id,
        version: c.version,
        contentieux: { ...input, status: 'Répondu', fees: '6' },
      })
    ).status,
    200,
  );
  c = (await get()).contentieux.find((x) => x.id === saved.id);
  assert.deepEqual(
    c.attachments.map((a) => a.name),
    ['courrier-recommande.pdf'],
  );
  assert.ok(c.history.some((h) => h.text === 'Pièce jointe ajoutée : courrier-recommande.pdf'));
  const removed = await fetch(origin + '/api/attachments', {
    method: 'DELETE',
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: c.id, att: upload.attachment.id, ct: true }),
  });
  assert.equal(removed.status, 200);
  c = (await get()).contentieux.find((x) => x.id === saved.id);
  assert.equal(c.attachments.length, 0);
  assert.equal((await post({ action: 'contentieux-delete', id: c.id })).status, 200);
  assert.ok(!(await get()).contentieux.some((x) => x.id === saved.id));
});
