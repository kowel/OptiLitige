/*
 * OptiLitige — export des commentaires et pièces jointes d'une liste SharePoint.
 *
 * À coller dans la console du navigateur (F12 → onglet « Console »), sur la page de la liste
 * SharePoint, en étant connecté avec un compte qui a accès à la liste. Mode d'emploi :
 * scripts/sharepoint/MODE-EMPLOI.md.
 *
 * LECTURE SEULE : le script ne fait que des requêtes GET sur l'API REST de SharePoint, avec vos
 * droits habituels. Il ne modifie rien dans SharePoint et n'envoie rien ailleurs : il écrit
 * dans un dossier de votre PC que vous choisissez :
 *   reprise.json          commentaires (et réponses) de chaque élément, liste des pièces jointes
 *   pj/<ID>/<fichier>     pièces jointes, rangées par ID d'élément
 * Le dossier est ensuite envoyé dans OptiLitige par scripts/reprise-sharepoint.mjs.
 */
(async () => {
  const ctx = window._spPageContextInfo || {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = (url) =>
    fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json;odata=nometadata' },
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status + ' ' + url))));

  // Site qui contient la liste (site SharePoint ou espace OneDrive « /personal/… »)
  const listPath = (decodeURIComponent(location.pathname).match(/^(.*\/Lists\/[^/]+)/i) || [])[1];
  const web =
    ctx.webAbsoluteUrl ||
    (listPath ? location.origin + encodeURI(listPath.replace(/\/Lists\/[^/]+$/i, '')) : '');
  if (!web) return alert('Ouvrez d’abord la liste SharePoint (page de la liste), puis relancez.');

  // La liste ouverte, retrouvée par son identifiant ou son adresse plutôt que par son nom
  // (le nom affiché peut différer du nom réel) ; à défaut, choix parmi les listes du site
  let info = null;
  const tries = [];
  if (ctx.listId)
    tries.push(web + "/_api/web/lists(guid'" + String(ctx.listId).replace(/[{}]/g, '') + "')");
  if (listPath)
    tries.push(
      web + "/_api/web/GetList('" + encodeURIComponent(listPath.replace(/'/g, "''")) + "')",
    );
  for (const url of tries) {
    info = await read(url + '?$select=Id,Title,ItemCount').catch(() => null);
    if (info) break;
  }
  if (!info) {
    const lists = await read(
      web + '/_api/web/lists?$select=Id,Title,ItemCount&$filter=Hidden eq false',
    ).catch(() => ({ value: [] }));
    const names = (lists.value || []).map((l) => l.Title + ' (' + l.ItemCount + ' éléments)');
    const title = prompt(
      'Liste introuvable automatiquement. Nom exact de la liste ?\n\nListes de ce site :\n' +
        (names.join('\n') || '(aucune trouvée)'),
      (lists.value || []).find((l) => /litige/i.test(l.Title))?.Title || '',
    );
    if (!title) return;
    info = (lists.value || []).find((l) => l.Title === title);
    if (!info) return alert('Liste « ' + title + ' » introuvable sur ce site.');
  }
  const LIST = info.Title;
  const api = web + "/_api/web/lists(guid'" + info.Id + "')";
  if (
    !confirm(
      'Exporter les commentaires et pièces jointes de la liste « ' +
        LIST +
        ' » (' +
        info.ItemCount +
        ' éléments) ?',
    )
  )
    return;

  // Petit panneau de suivi, en haut à droite de la page
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:99999;width:360px;padding:16px;border-radius:12px;' +
    'background:#1d2140;color:#fff;font:13px/1.45 Segoe UI,sans-serif;box-shadow:0 10px 30px #0006';
  box.innerHTML =
    '<b style="font-size:14px">OptiLitige · export SharePoint</b><div id="ol-msg" style="margin:8px 0">' +
    'Liste : ' +
    LIST +
    '</div><button id="ol-go" style="padding:8px 12px;border:0;border-radius:8px;background:#7b62ff;' +
    'color:#fff;cursor:pointer">Choisir le dossier de destination…</button>';
  document.body.appendChild(box);
  const say = (t) => (box.querySelector('#ol-msg').textContent = t);

  // Requête GET avec nouvelle tentative si SharePoint demande de ralentir : 429 / 503, ou
  // redirection vers sa page « Throttle.htm » (réponse 406). Attente de plus en plus longue.
  // (window.__olWaits : attentes raccourcies pour les tests)
  const WAITS = window.__olWaits || [10, 20, 30, 60, 60, 90, 120, 120, 180, 180];
  let throttledUntil = 0;
  async function get(url, as = 'json') {
    for (let attempt = 0; attempt <= WAITS.length; attempt++) {
      // Quand SharePoint a freiné, toutes les requêtes attendent la fin de la pause
      while (Date.now() < throttledUntil) await sleep(1000);
      const res = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json;odata=nometadata' },
      });
      const throttled =
        res.status === 429 ||
        res.status === 503 ||
        res.status === 406 ||
        /throttle\.htm/i.test(res.url || '');
      if (throttled && attempt < WAITS.length) {
        const wait = Number(res.headers.get('Retry-After')) || WAITS[attempt];
        throttledUntil = Math.max(throttledUntil, Date.now() + wait * 1000);
        say('SharePoint demande de ralentir : pause de ' + wait + ' s, puis reprise automatique…');
        continue;
      }
      if (!res.ok) throw new Error(res.status + ' ' + url);
      return as === 'json' ? res.json() : res.blob();
    }
    throw new Error('SharePoint ne répond plus (trop de requêtes) : ' + url);
  }

  // Texte d'un commentaire : SharePoint l'envoie encodé (« &#123; » pour « { », « &quot; »…) ;
  // on le décode, puis les mentions « @mention{0} » sont remplacées par le nom de la personne
  const decoder = document.createElement('textarea');
  const decode = (v) => {
    decoder.innerHTML = String(v || '');
    return decoder.value;
  };
  const text = (c) =>
    decode(c.text).replace(/@mention\{(\d+)\}/g, (_, i) =>
      c.mentions && c.mentions[i] ? '@' + c.mentions[i].name : '@…',
    );
  const comment = (c, parent) => ({
    sourceKey: 'sp-comment-' + c.id,
    parent: parent || null,
    author: (c.author && c.author.name) || 'Inconnu',
    email: (c.author && c.author.email) || '',
    date: c.createdDate,
    text: text(c),
    mentions: (c.mentions || []).map((m) => m.name).filter(Boolean),
  });
  // Nom de fichier sans caractères interdits par Windows
  const safe = (n) => String(n).replace(/[\\/:*?"<>|]/g, '_');

  box.querySelector('#ol-go').onclick = async () => {
    let dir;
    try {
      dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch {
      return say('Aucun dossier choisi. Cliquez à nouveau pour recommencer.');
    }
    box.querySelector('#ol-go').remove();
    try {
      // 1. Tous les éléments de la liste (ID + présence de pièces jointes)
      say('Lecture des éléments de la liste…');
      const items = [];
      let next = api + '/items?$select=ID,Attachments&$top=500';
      while (next) {
        const page = await get(next);
        items.push(...page.value);
        next = page['odata.nextLink'] || null;
      }
      const pjDir = await dir.getDirectoryHandle('pj', { create: true });
      // Relance dans le même dossier : on garde l'export précédent et on ne reprend que les
      // éléments en échec (ceux listés dans failedIds, ou cités dans les problèmes)
      const prev = await dir
        .getFileHandle('reprise.json')
        .then((h) => h.getFile())
        .then((f) => f.text())
        .then(JSON.parse)
        .catch(() => null);
      const retry =
        prev && prev.list === LIST
          ? new Set(
              (prev.failedIds || [])
                .concat(
                  (prev.problems || []).map((p) => (String(p).match(/élément (\d+)/) || [])[1]),
                )
                .filter(Boolean)
                .map(String),
            )
          : null;
      // Export précédent complet : proposer de relire seulement les commentaires (sans
      // retélécharger les pièces jointes), par exemple après une correction du script
      let commentsOnly = false;
      if (retry && !retry.size) {
        if (
          !confirm(
            'L’export de ce dossier est déjà complet.\n\nRelire uniquement les commentaires ' +
              '(sans retélécharger les pièces jointes) ?',
          )
        )
          return say('L’export précédent de ce dossier est déjà complet.');
        commentsOnly = true;
      }
      const prevAttachments = new Map(
        ((prev && prev.items) || []).map((e) => [String(e.id), e.attachments || []]),
      );
      const todo = commentsOnly
        ? items
        : retry
          ? items.filter((i) => retry.has(String(i.ID)))
          : items;
      const out = {
        list: LIST,
        site: web,
        exportedAt: new Date().toISOString(),
        items: retry && !commentsOnly ? prev.items.filter((e) => !retry.has(String(e.id))) : [],
      };
      if (commentsOnly) say('Relecture des commentaires de ' + todo.length + ' éléments…');
      else if (retry)
        say('Reprise des ' + todo.length + ' élément(s) en échec lors de l’export précédent…');
      let done = 0,
        nComments = 0,
        nFiles = 0;
      const problems = [];
      const failedIds = new Set();

      // 2. Commentaires et pièces jointes, trois éléments à la fois
      async function one(item) {
        const entry = {
          id: String(item.ID),
          comments: [],
          attachments: commentsOnly ? prevAttachments.get(String(item.ID)) || [] : [],
        };
        try {
          const list = await get(api + '/GetItemById(' + item.ID + ')/Comments()?$top=500');
          for (const c of list.value || []) {
            entry.comments.push(comment(c));
            if (c.replyCount > 0) {
              const replies = await get(
                api + '/GetItemById(' + item.ID + ')/Comments(' + c.id + ')/replies?$top=500',
              );
              for (const r of replies.value || []) entry.comments.push(comment(r, c.id));
            }
          }
        } catch (e) {
          problems.push('Commentaires de l’élément ' + item.ID + ' : ' + e.message);
          failedIds.add(String(item.ID));
        }
        if (item.Attachments && !commentsOnly) {
          try {
            const files = await get(api + '/items(' + item.ID + ')/AttachmentFiles');
            if ((files.value || []).length) {
              const folder = await pjDir.getDirectoryHandle(String(item.ID), { create: true });
              for (const f of files.value) {
                // Adresse directe du fichier ; sinon, par l'API (noms avec caractères spéciaux)
                const blob = await get(
                  location.origin + encodeURI(f.ServerRelativeUrl),
                  'blob',
                ).catch(() =>
                  get(
                    web +
                      "/_api/web/GetFileByServerRelativePath(decodedurl='" +
                      encodeURIComponent(f.ServerRelativeUrl.replace(/'/g, "''")) +
                      "')/$value",
                    'blob',
                  ),
                );
                const name = safe(f.FileName);
                const handle = await folder.getFileHandle(name, { create: true });
                const w = await handle.createWritable();
                await w.write(blob);
                await w.close();
                entry.attachments.push({
                  name,
                  size: blob.size,
                  file: 'pj/' + item.ID + '/' + name,
                });
                nFiles++;
              }
            }
          } catch (e) {
            problems.push('Pièces jointes de l’élément ' + item.ID + ' : ' + e.message);
            failedIds.add(String(item.ID));
          }
        }
        nComments += entry.comments.length;
        if (entry.comments.length || entry.attachments.length) out.items.push(entry);
        done++;
        say(
          'Éléments traités : ' +
            done +
            ' / ' +
            todo.length +
            ' · ' +
            nComments +
            ' commentaire(s) · ' +
            nFiles +
            ' pièce(s) jointe(s)',
        );
      }
      // Deux éléments à la fois, pour ménager SharePoint
      const queue = [...todo];
      await Promise.all(
        [0, 1].map(async () => {
          while (queue.length) await one(queue.shift());
        }),
      );

      // 3. Fichier récapitulatif
      out.problems = problems;
      out.failedIds = [...failedIds];
      out.totals = {
        items: items.length,
        comments: out.items.reduce((n, e) => n + e.comments.length, 0),
        attachments: out.items.reduce((n, e) => n + e.attachments.length, 0),
      };
      const h = await dir.getFileHandle('reprise.json', { create: true });
      const w = await h.createWritable();
      await w.write(JSON.stringify(out, null, 2));
      await w.close();
      say(
        'Terminé : ' +
          out.totals.comments +
          ' commentaire(s) et ' +
          out.totals.attachments +
          ' pièce(s) jointe(s) pour ' +
          items.length +
          ' éléments' +
          (retry
            ? ' (dont ' +
              nComments +
              ' commentaire(s) et ' +
              nFiles +
              ' pièce(s) jointe(s) repris à l’instant)'
            : '') +
          '.' +
          (failedIds.size
            ? ' ' +
              failedIds.size +
              ' élément(s) encore en échec : relancez le script dans le même dossier.'
            : ' Aucun échec.'),
      );
    } catch (e) {
      say('Arrêt : ' + e.message);
    }
  };
})();
