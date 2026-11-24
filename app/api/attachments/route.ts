import { env } from '../../server/env';
import { moveToTrash } from '../../server/file-store';
import { TRASH_SETTINGS_KEY, trashHistoryText } from '../../trash-settings.mjs';
import { sameOrigin } from '../../server/origin';
import { context, failure, out, updateRecord } from '../context';
import {
  canDeleteAttachment,
  checkAttachment,
  confirmConflict,
  REPRISE_LIMITS,
  cleanFileName,
  contentDisposition,
  contentTypeOf,
  isInline,
} from '../../attachment-rules.mjs';
import type { Attachment, Contentieux, Member, RecordRow } from '../../types';
export const dynamic = 'force-dynamic';

// Pièces jointes d'un dossier. Les fichiers sont stockés dans R2 (binding BUCKET) sous
// attachments/<dossier>/<pièce> ; la liste (nom, taille, auteur…) est rangée dans le dossier
// lui-même (champ `attachments`), comme les commentaires.

const keyOf = (recordId: string, attachmentId: string) =>
  'attachments/' + recordId + '/' + attachmentId;

// Pièces jointes d'un contentieux (espace des responsables, paramètre « ct ») : fichiers sous
// contentieux/<id>/<pièce>, liste rangée dans le contentieux lui-même (settings
// « contentieux:<id> », champ `attachments`)
const CT_PREFIX = 'contentieux:';
const ctKeyOf = (id: string, att: string) => 'contentieux/' + id + '/' + att;
const notAdmin = (member: Member) =>
  member.role !== 'Admin' ? out({ error: 'Espace Contentieux réservé aux admins.' }, 403) : null;

async function readContentieux(db: D1Database, id: string) {
  const row = await db
    .prepare('SELECT payload FROM settings WHERE id=?')
    .bind(CT_PREFIX + id)
    .first<{ payload: string }>();
  return row?.payload ?? null;
}

// Liste des pièces modifiée sans changer la version du contentieux : un ajout ne bloque pas
// l'enregistrement de la fiche ouverte (qui garde, elle, la liste en place : app/api/data)
async function updateContentieux(
  db: D1Database,
  id: string,
  change: (c: Contentieux) => Response | void,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await readContentieux(db, id);
    if (!raw) return out({ error: 'Contentieux introuvable.' }, 404);
    const c: Contentieux = JSON.parse(raw);
    const refused = change(c);
    if (refused) return refused;
    const result = await db
      .prepare('UPDATE settings SET payload=? WHERE id=? AND payload=?')
      .bind(JSON.stringify(c), CT_PREFIX + id, raw)
      .run();
    if (result.meta.changes) return null;
  }
  return out({ error: 'Le contentieux est très sollicité. Réessayez dans un instant.' }, 409);
}

function bucket() {
  const b = env.BUCKET;
  if (!b) throw new Error('503|Le stockage des pièces jointes n’est pas encore configuré.');
  return b;
}

export async function GET(req: Request) {
  try {
    const { db, member } = await context();
    const params = new URL(req.url).searchParams;
    const id = String(params.get('id') || ''),
      att = String(params.get('att') || ''),
      ct = params.get('ct') === '1';
    if (!id || !att || id.length > 200 || att.length > 200)
      return out({ error: 'Pièce jointe invalide.' }, 400);
    if (ct) {
      const refused = notAdmin(member);
      if (refused) return refused;
    }
    const payload = ct
      ? await readContentieux(db, id)
      : (
          await db
            .prepare('SELECT payload FROM records WHERE id=?')
            .bind(id)
            .first<Pick<RecordRow, 'payload'>>()
        )?.payload;
    const meta =
      payload && (JSON.parse(payload).attachments || []).find((a: Attachment) => a.id === att);
    if (!meta) return out({ error: 'Pièce jointe introuvable.' }, 404);
    const store = bucket();
    const key = ct ? ctKeyOf(id, att) : keyOf(id, att);
    const type = contentTypeOf(meta.name);
    // En ligne : le navigateur lit le fichier directement dans le stockage, par une adresse
    // temporaire (une photo de plus de 4,5 Mo ne peut pas passer par une fonction Vercel)
    if (store.signedDownloadUrl) {
      const link = await store.signedDownloadUrl(
        key,
        isInline(type) ? null : cleanFileName(meta.name),
      );
      if (!link) return out({ error: 'Fichier introuvable dans le stockage.' }, 404);
      return new Response(null, {
        status: 302,
        headers: { Location: link, 'Cache-Control': 'private, no-store' },
      });
    }
    const object = await store.get(key);
    if (!object) return out({ error: 'Fichier introuvable dans le stockage.' }, 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': type,
        'Content-Disposition': contentDisposition(meta.name, isInline(type)),
        'Content-Length': String(object.size),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
      },
    });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return out({ error: 'Origine non autorisée' }, 403);
    const { db, member } = await context();
    // Adresse partagée : on agit toujours au nom d'un profil
    if (member.profiles?.length && !member.profile)
      return out({ error: 'Choisissez d’abord votre profil (« Qui êtes-vous ? »).' }, 428);
    const store = bucket();
    // Deux façons d'envoyer un fichier :
    // - formulaire (multipart) avec le fichier : serveur local, petits fichiers ;
    // - envoi direct (en ligne, Vercel limitant une requête à 4,5 Mo) : « prepare » vérifie
    //   les droits et les limites puis donne une adresse signée Supabase Storage ; le navigateur y
    //   envoie le fichier ; « confirm » vérifie le fichier reçu et l'ajoute au dossier.
    const direct = (req.headers.get('content-type') || '').includes('application/json');
    let form: { get(name: string): unknown };
    let file: { name: string; size: number };
    let data: ArrayBuffer | null = null;
    let step = '';
    let givenId = '';
    if (direct) {
      const b = (await req.json()) as Record<string, unknown>;
      form = { get: (k: string) => (b[k] === undefined || b[k] === null ? null : String(b[k])) };
      step = String(b.step || '');
      givenId = String(b.attachmentId || '');
      file = { name: String(b.name || ''), size: Number(b.size) || 0 };
      if (!['prepare', 'confirm'].includes(step) || !file.name)
        return out({ error: 'Choisissez un fichier.' }, 400);
      if (step === 'confirm' && !/^[0-9a-f-]{36}$/.test(givenId))
        return out({ error: 'Envoi invalide.' }, 400);
    } else {
      const fd = await req.formData();
      const f = fd.get('file');
      if (!f || typeof f === 'string') return out({ error: 'Choisissez un fichier.' }, 400);
      form = fd;
      file = f;
      data = await f.arrayBuffer();
    }
    const id = String(form.get('id') || '');
    if (!id || id.length > 200) return out({ error: 'Choisissez un fichier.' }, 400);
    const name = cleanFileName(file.name);
    // Envoi direct : adresse signée (prepare), ou taille réelle du fichier reçu (confirm)
    const signed = async (key: string, attachmentId: string) => {
      if (!store.signedUploadUrl) return out({ direct: false });
      const s = await store.signedUploadUrl(key);
      return out({ direct: true, attachmentId, url: s!.url });
    };
    const received = async (key: string) => {
      const got = await store.info?.(key);
      if (!got) return out({ error: 'Fichier non reçu par le stockage : réessayez.' }, 400);
      // Type enregistré par le stockage = type attendu pour ce nom (jamais une page HTML
      // déguisée en photo, servie ensuite telle quelle)
      if (got.type !== contentTypeOf(name)) {
        await store.delete(key);
        return out({ error: 'Type de fichier inattendu : ' + file.name }, 400);
      }
      file = { name: file.name, size: got.size };
      return null;
    };
    if (form.get('ct') === '1') {
      const refused = notAdmin(member);
      if (refused) return refused;
      const raw = await readContentieux(db, id);
      if (!raw) return out({ error: 'Contentieux introuvable.' }, 404);
      const problem = checkAttachment(
        { name: file.name, size: file.size },
        (JSON.parse(raw).attachments || []).length,
      );
      if (problem) return out({ error: problem }, 400);
      if (step === 'prepare') {
        const next = crypto.randomUUID();
        return signed(ctKeyOf(id, next), next);
      }
      if (step === 'confirm') {
        // Identifiant déjà rattaché : refusé AVANT tout contrôle qui pourrait effacer le fichier
        const taken = confirmConflict(JSON.parse(raw).attachments, givenId);
        if (taken) return out({ error: taken }, 409);
        const bad = await received(ctKeyOf(id, givenId));
        if (bad) return bad;
      }
      const attachmentId = givenId || crypto.randomUUID(),
        now = new Date().toISOString();
      if (data)
        await store.put(ctKeyOf(id, attachmentId), data, {
          httpMetadata: { contentType: contentTypeOf(name) },
          customMetadata: { contentieuxId: id, name, uploadedBy: member.email },
        });
      // Pièce ajoutée entre-temps avec le même identifiant : son fichier n'est jamais effacé
      let ctDuplicate = false;
      const meta: Attachment = {
        id: attachmentId,
        name,
        size: file.size,
        date: now,
        author: member.name,
        email: member.email,
      };
      const refusedSave = await updateContentieux(db, id, (c) => {
        const list = c.attachments || [];
        const taken = confirmConflict(list, attachmentId);
        if (taken) {
          ctDuplicate = true;
          return out({ error: taken }, 409);
        }
        const again = checkAttachment({ name, size: file.size }, list.length);
        if (again) return out({ error: again }, 400);
        c.attachments = [...list, meta];
        c.history = [
          ...(c.history || []),
          { date: now, text: 'Pièce jointe ajoutée : ' + name, author: member.name },
        ];
      });
      if (refusedSave) {
        if (!ctDuplicate) await store.delete(ctKeyOf(id, attachmentId));
        return refusedSave;
      }
      return out({ ok: true, attachment: meta });
    }
    const current = await db
      .prepare('SELECT payload FROM records WHERE id=?')
      .bind(id)
      .first<Pick<RecordRow, 'payload'>>();
    if (!current) return out({ error: 'Dossier introuvable' }, 404);
    // Reprise d'une pièce jointe d'origine (export SharePoint) : réservée aux admins, sur
    // un dossier importé ; auteur et date d'origine conservés, doublon ignoré
    const sourceKey = String(form.get('sourceKey') || '');
    const existing = JSON.parse(current.payload);
    if (sourceKey) {
      if (member.role !== 'Admin' || !existing.sourceList)
        return out({ error: 'Reprise réservée aux admins, sur un dossier importé.' }, 403);
      if (sourceKey.length > 300) return out({ error: 'Référence d’origine invalide.' }, 400);
      if ((existing.attachments || []).some((a: Attachment) => a.sourceKey === sourceKey))
        return out({ ok: true, skipped: true });
    }
    const sourceDate = String(form.get('sourceDate') || '');
    const limits = sourceKey ? REPRISE_LIMITS : undefined;
    const problem = checkAttachment(
      { name: file.name, size: file.size },
      (existing.attachments || []).length,
      limits,
    );
    if (problem) return out({ error: problem }, 400);
    if (step === 'prepare') {
      const next = crypto.randomUUID();
      return signed(keyOf(id, next), next);
    }
    if (step === 'confirm') {
      // Identifiant déjà rattaché : refusé AVANT tout contrôle qui pourrait effacer le fichier
      const taken = confirmConflict(existing.attachments, givenId);
      if (taken) return out({ error: taken }, 409);
      const bad = await received(keyOf(id, givenId));
      if (bad) return bad;
    }
    // Pièce ajoutée entre-temps avec le même identifiant : son fichier n'est jamais effacé
    let duplicate = false;
    const attachmentId = givenId || crypto.randomUUID(),
      now = new Date().toISOString();
    if (data)
      await store.put(keyOf(id, attachmentId), data, {
        httpMetadata: { contentType: contentTypeOf(name) },
        customMetadata: { recordId: id, name, uploadedBy: member.email },
      });
    const meta: Attachment = sourceKey
      ? {
          id: attachmentId,
          name,
          size: file.size,
          date: Number.isFinite(Date.parse(sourceDate)) ? new Date(sourceDate).toISOString() : now,
          author: String(form.get('sourceAuthor') || 'SharePoint').slice(0, 200),
          email: '',
          sourceKey,
        }
      : {
          id: attachmentId,
          name,
          size: file.size,
          date: now,
          author: member.name,
          email: member.email,
        };
    const refused = await updateRecord(db, id, (r) => {
      const list = r.attachments || [];
      const taken = confirmConflict(list, attachmentId);
      if (taken) {
        duplicate = true;
        return out({ error: taken }, 409);
      }
      const again = checkAttachment({ name, size: file.size }, list.length, limits);
      if (again) return out({ error: again }, 400);
      r.attachments = [...list, meta];
      r.history = [
        ...(r.history || []),
        {
          date: now,
          text:
            (sourceKey ? 'Pièce jointe reprise de SharePoint : ' : 'Pièce jointe ajoutée : ') +
            name,
          author: member.name,
        },
      ];
    });
    if (refused) {
      if (!duplicate) await store.delete(keyOf(id, attachmentId));
      return refused;
    }
    return out({ ok: true, attachment: meta });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(req: Request) {
  try {
    if (!sameOrigin(req)) return out({ error: 'Origine non autorisée' }, 403);
    const { db, member } = await context();
    // Adresse partagée : on agit toujours au nom d'un profil
    if (member.profiles?.length && !member.profile)
      return out({ error: 'Choisissez d’abord votre profil (« Qui êtes-vous ? »).' }, 428);
    const store = bucket();
    const b = (await req.json()) as { id?: unknown; att?: unknown; ct?: unknown } | null;
    const id = String(b?.id || ''),
      att = String(b?.att || ''),
      ct = b?.ct === true;
    if (!id || !att || id.length > 200 || att.length > 200)
      return out({ error: 'Pièce jointe invalide.' }, 400);
    const now = new Date().toISOString();
    // Réglage de la corbeille (Paramètres) : précisé dans l'historique du dossier
    const trash = JSON.parse(
      (
        await db
          .prepare('SELECT payload FROM settings WHERE id=?')
          .bind(TRASH_SETTINGS_KEY)
          .first<{ payload: string }>()
      )?.payload || 'null',
    );
    if (ct) {
      const forbidden = notAdmin(member);
      if (forbidden) return forbidden;
      const refused = await updateContentieux(db, id, (c) => {
        const meta = (c.attachments || []).find((a) => a.id === att);
        if (!meta) return out({ error: 'Pièce jointe introuvable.' }, 404);
        c.attachments = c.attachments!.filter((a) => a.id !== att);
        c.history = [
          ...(c.history || []),
          {
            date: now,
            text: trashHistoryText(meta.name, trash),
            author: member.name,
          },
        ];
      });
      if (refused) return refused;
      await moveToTrash(store, ctKeyOf(id, att), member.email, now);
      return out({ ok: true });
    }
    const refused = await updateRecord(db, id, (r) => {
      const meta = (r.attachments || []).find((a: Attachment) => a.id === att);
      if (!meta) return out({ error: 'Pièce jointe introuvable.' }, 404);
      if (!canDeleteAttachment(meta, member))
        return out({ error: 'Seuls l’auteur et les admins peuvent la supprimer.' }, 403);
      r.attachments = r.attachments!.filter((a) => a.id !== att);
      r.history = [
        ...(r.history || []),
        {
          date: now,
          text: trashHistoryText(meta.name, trash),
          author: member.name,
        },
      ];
    });
    if (refused) return refused;
    // Corbeille : le fichier n'est pas effacé mais rangé sous corbeille/… (récupérable ; effacé
    // seulement si un admin active le vidage automatique dans Paramètres)
    await moveToTrash(store, keyOf(id, att), member.email, now);
    return out({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
