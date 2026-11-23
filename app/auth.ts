// Point d'entrée unique de l'authentification d'OptiLitige (version Supabase / Vercel).
//
// AUTH_MODE :
//   - "supabase" (défaut en production) : connexion Microsoft (Entra ID) par Supabase Auth,
//     session vérifiée auprès de Supabase à chaque appel. Seules les adresses des domaines de
//     ALLOWED_EMAIL_DOMAINS (ex. « cybertek.fr ») sont acceptées, puis l'agent doit être
//     autorisé dans « Équipe & accès ».
//   - "local" (défaut hors production) : connexion simulée du serveur de développement et des
//     tests (cookie posé par /auth/connexion). Refusée en production : une variable oubliée ne
//     doit jamais ouvrir l'outil.
//
// L'identifiant interne de l'utilisateur est son e-mail en minuscules, comme dans la version
// Cloudflare : il reste stable même si le fournisseur d'identité change.
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export type AppUser = { userId: string; email: string; displayName: string };

export const LOCAL_COOKIE = 'optilitige-local';
export const LOCAL_USER = {
  email: process.env.DEV_USER_EMAIL || 'seedy@sites.test',
  name: process.env.DEV_USER_NAME || 'Seedy',
};

export function authMode(): 'local' | 'supabase' {
  const production = process.env.NODE_ENV === 'production';
  const mode = String(process.env.AUTH_MODE || (production ? 'supabase' : 'local')).trim();
  if (mode === 'supabase') return mode;
  if (mode === 'local' && !production) return mode;
  throw new Error('503|Configuration d’authentification invalide (AUTH_MODE).');
}

/** Lien affiché quand la session a expiré. */
export function signInHref(): string {
  return '/auth/connexion?return_to=/';
}

/** Adresse de déconnexion (déconnexion automatique après inactivité, app/idle-logout.tsx). */
export function signOutHref(): string {
  return '/auth/deconnexion';
}

/** Client Supabase lié aux cookies de la requête (session de l'agent) */
export async function supabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('503|Supabase n’est pas configuré sur le serveur.');
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Lecture seule (rendu d'une page) : la session sera rafraîchie à l'appel suivant
        }
      },
    },
  });
}

/** Domaine de l'adresse autorisé (ALLOWED_EMAIL_DOMAINS, séparés par des virgules) */
export function allowedEmail(email: string): boolean {
  const domains = String(process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (!domains.length) return process.env.NODE_ENV !== 'production';
  return domains.includes(email.split('@')[1] || '');
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (authMode() === 'local') {
    const email = (await cookies()).get(LOCAL_COOKIE)?.value;
    if (!email) return null;
    const e = email.toLowerCase();
    return { userId: e, email: e, displayName: e === LOCAL_USER.email ? LOCAL_USER.name : e };
  }
  const supabase = await supabaseAuthClient();
  // getUser() vérifie la session auprès de Supabase (pas seulement le cookie)
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  // Compte Microsoft seulement : un compte créé autrement (e-mail, autre fournisseur) n'ouvre
  // jamais l'outil, même avec une adresse du bon domaine
  const providers = [
    data.user.app_metadata?.provider,
    ...((data.user.app_metadata?.providers as string[] | undefined) || []),
  ];
  if (!providers.includes('azure')) return null;
  const email = data.user.email.trim().toLowerCase();
  if (!allowedEmail(email)) return null;
  const meta = data.user.user_metadata || {};
  const name = String(meta.full_name || meta.name || '').trim() || email;
  return { userId: email, email, displayName: name };
}
