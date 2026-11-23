// Stockage des pièces jointes, avec la même forme que le stockage Cloudflare R2 de la version
// d'origine : get(clé), put(clé, contenu, options), delete(clé).
// - En ligne : Supabase Storage, compartiment privé (SUPABASE_BUCKET, « pieces-jointes » par
//   défaut), lu et écrit par le serveur seulement avec la clé de service.
// - En local : dossier .donnees-locales/fichiers du projet.
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export interface StoredFile {
  body: Blob;
  size: number;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

export interface PutOptions {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

type Body = ArrayBuffer | Uint8Array | Blob | ReadableStream | string;

export interface FileStore {
  get(key: string): Promise<StoredFile | null>;
  put(key: string, body: Body, options?: PutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  /** Adresse d'envoi direct (navigateur → stockage), sans passer par le serveur ; null en local */
  signedUploadUrl?(key: string): Promise<{ url: string; token: string } | null>;
  /** Taille et type d'un fichier déjà envoyé (contrôle après un envoi direct), null s'il manque */
  info?(key: string): Promise<{ size: number; type: string } | null>;
  /**
   * Adresse de lecture temporaire (navigateur ← stockage), pour ne pas faire passer les gros
   * fichiers par le serveur (Vercel : 4,5 Mo par réponse au plus). Avec un nom : téléchargement.
   */
  signedDownloadUrl?(key: string, downloadName: string | null): Promise<string | null>;
  /** Déplacement sans recopie (corbeille) ; sinon lecture puis écriture */
  move?(from: string, to: string): Promise<void>;
}

const toBlob = async (body: Body, type?: string) =>
  body instanceof Blob
    ? body
    : body instanceof ReadableStream
      ? new Blob([await new Response(body).arrayBuffer()], { type })
      : new Blob([body as BlobPart], { type });

/**
 * Pièce supprimée : rangée sous « corbeille/<date de suppression>/<clé> » (récupérable). Rien
 * n'est effacé, sauf si un admin active le vidage automatique (Paramètres → Corbeille des pièces
 * jointes, tâche /api/cron/corbeille) ; la date dans la clé suffit alors au tri.
 */
export async function moveToTrash(store: FileStore, key: string, by: string, at: string) {
  const trashKey = 'corbeille/' + at.slice(0, 10) + '/' + key;
  if (store.move) {
    // Supabase : déplacement sans recopie ; un fichier déjà absent n'est pas une erreur
    await store.move(key, trashKey).catch(() => {});
    return;
  }
  const object = await store.get(key);
  if (!object) return;
  await store.put(trashKey, object.body, {
    httpMetadata: object.httpMetadata,
    customMetadata: { ...object.customMetadata, deletedBy: by, deletedAt: at },
  });
  await store.delete(key);
}

/** Supabase Storage (clé de service : jamais envoyée au navigateur) */
export function supabaseStore(url: string, serviceKey: string, bucket: string): FileStore {
  const storage = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(bucket);
  return {
    async get(key) {
      const { data, error } = await storage.download(key);
      if (error || !data) return null;
      return { body: data, size: data.size, httpMetadata: { contentType: data.type } };
    },
    async put(key, body, options) {
      const type = options?.httpMetadata?.contentType || 'application/octet-stream';
      const { error } = await storage.upload(key, await toBlob(body, type), {
        contentType: type,
        upsert: true,
      });
      if (error) throw new Error('Stockage des fichiers : ' + error.message);
    },
    async delete(key) {
      await storage.remove([key]);
    },
    async signedUploadUrl(key) {
      // Sans remplacement : l'adresse (valable 2 h) ne peut pas écraser un fichier déjà contrôlé
      const { data, error } = await storage.createSignedUploadUrl(key, { upsert: false });
      if (error || !data) throw new Error('Stockage des fichiers : ' + (error?.message || ''));
      return { url: data.signedUrl, token: data.token };
    },
    async info(key) {
      const slash = key.lastIndexOf('/');
      const { data } = await storage.list(key.slice(0, slash), {
        search: key.slice(slash + 1),
        limit: 1,
      });
      const item = (data || []).find((f) => f.name === key.slice(slash + 1));
      return item
        ? {
            size: Number(item.metadata?.size ?? 0),
            type: String(item.metadata?.mimetype || '')
              .split(';')[0]
              .trim(),
          }
        : null;
    },
    async signedDownloadUrl(key, downloadName) {
      // 5 minutes : le temps d'ouvrir le fichier ; le lien n'est jamais enregistré
      const { data, error } = await storage.createSignedUrl(
        key,
        300,
        downloadName ? { download: downloadName } : undefined,
      );
      return error || !data ? null : data.signedUrl;
    },
    async move(from, to) {
      const { error } = await storage.move(from, to);
      if (error) throw new Error('Stockage des fichiers : ' + error.message);
    },
  };
}

/** Dossier local (serveur de développement et tests) */
export function localStore(root: string): FileStore {
  const base = resolve(root);
  const pathOf = (key: string) => {
    const p = resolve(join(base, key));
    if (!p.startsWith(base + sep)) throw new Error('Clé de fichier invalide.');
    return p;
  };
  return {
    async get(key) {
      try {
        const data = await readFile(pathOf(key));
        let meta: PutOptions = {};
        try {
          meta = JSON.parse(await readFile(pathOf(key) + '.meta.json', 'utf8'));
        } catch {
          // pas de métadonnées
        }
        const type = meta.httpMetadata?.contentType || 'application/octet-stream';
        return {
          body: new Blob([data], { type }),
          size: data.length,
          httpMetadata: meta.httpMetadata,
          customMetadata: meta.customMetadata,
        };
      } catch {
        return null;
      }
    },
    async put(key, body, options) {
      const p = pathOf(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, new Uint8Array(await (await toBlob(body)).arrayBuffer()));
      await writeFile(p + '.meta.json', JSON.stringify(options || {}));
    },
    async delete(key) {
      await rm(pathOf(key), { force: true });
      await rm(pathOf(key) + '.meta.json', { force: true });
    },
  };
}
