// Plusieurs personnes sur une même adresse de connexion (ex. la boîte du Service Litige utilisée
// par Aurélien et Lydia). Les responsables déclarent les profils de l'adresse (Équipe & accès) ;
// chacun choisit le sien à la connexion (cookie « optilitige_profil »). Chaque profil devient un
// agent à part entière : identifiant « adresse#Prénom », nom affiché, mentions, notifications,
// rappels et dossiers suivis propres.
import type { Member } from '../types';

export const PROFILES_KEY = 'member-profiles';
export const PROFILE_COOKIE = 'optilitige_profil';
const SEP = '#';

export type ProfileMap = Record<string, string[]>;

// Identifiant d'un profil, en minuscules comme les adresses (comparaisons, mentions)
export const profileEmail = (email: string, name: string) =>
  (String(email) + SEP + String(name)).toLowerCase();

/** « adresse#Prénom » → { base: adresse, profile: Prénom } (profile vide pour une adresse simple) */
export function splitProfile(email: string) {
  const i = String(email || '').indexOf(SEP);
  return i < 0
    ? { base: String(email || ''), profile: '' }
    : { base: email.slice(0, i), profile: email.slice(i + 1) };
}

/** Noms de profils nettoyés : 2 à 10 profils, 40 caractères, sans doublon ni « # » */
export function normalizeProfiles(input: unknown): { profiles?: string[]; error?: string } {
  const list = (Array.isArray(input) ? input : String(input || '').split(','))
    .map((p) =>
      String(p || '')
        .replace(/[#;,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  const unique = [...new Set(list)];
  if (!unique.length) return { profiles: [] };
  if (unique.length < 2) return { error: 'Indiquez au moins deux profils (ou aucun).' };
  if (unique.length > 10) return { error: '10 profils au maximum.' };
  if (unique.some((p) => p.length > 40)) return { error: '40 caractères au maximum par profil.' };
  return { profiles: unique };
}

export async function loadProfiles(db: D1Database): Promise<ProfileMap> {
  const row = await db
    .prepare('SELECT payload FROM settings WHERE id=?')
    .bind(PROFILES_KEY)
    .first<{ payload: string }>();
  return row ? JSON.parse(row.payload) : {};
}

/** Agent actif d'après son identifiant (adresse simple ou « adresse#prénom ») ; null sinon */
export async function resolveMember(db: D1Database, email: string) {
  const { base, profile } = splitProfile(String(email || '').toLowerCase());
  const m = await db
    .prepare("SELECT name, email, role FROM members WHERE lower(email)=? AND role <> 'Désactivé'")
    .bind(base)
    .first<Member>();
  if (!m) return null;
  const names = (await loadProfiles(db))[m.email] || [];
  if (!profile) return names.length ? null : m;
  const name = names.find((n) => n.toLowerCase() === profile);
  return name ? { ...m, email: profileEmail(m.email, name), name } : null;
}

/** Profil choisi dans le cookie de la requête (vide sinon) */
export function chosenProfile(cookieHeader: string | null) {
  const m = new RegExp('(?:^|;\\s*)' + PROFILE_COOKIE + '=([^;]*)').exec(cookieHeader || '');
  try {
    return m ? decodeURIComponent(m[1]) : '';
  } catch {
    return '';
  }
}

/**
 * Agents vus par l'outil : chaque adresse à profils est remplacée par un agent par profil
 * (pour les mentions, l'attribution, les notifications) ; `account` garde l'adresse réelle.
 */
export function expandMembers<T extends Member>(members: T[], profiles: ProfileMap) {
  const out: (T & { account?: string; profileOf?: string })[] = [];
  for (const m of members) {
    const names = profiles[String(m.email).toLowerCase()] || [];
    if (!names.length) out.push(m);
    else
      for (const name of names)
        out.push({ ...m, email: profileEmail(m.email, name), name, profileOf: m.email });
  }
  return out;
}
