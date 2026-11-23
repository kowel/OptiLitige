// Listes métier pilotées par les responsables (Paramètres) : ajouter, renommer, déplacer,
// supprimer une valeur, et, au besoin, renommer aussi la valeur dans les anciens dossiers.
// Partagé par l'API (action « list-update ») et la démonstration.
import { carrierStages, clientStages } from './followup.ts';

// key → libellé, champ des dossiers qui porte la valeur, nombre maximal de valeurs
export const LIST_DEFS = {
  types: { label: 'Types de litiges', field: 'type', max: 60 },
  brands: { label: 'Enseignes', field: 'brand', max: 60 },
  stores: { label: 'Magasins (enseigne MAGASIN)', field: 'store', max: 150 },
  products: { label: 'Types de produits', field: 'productType', max: 60 },
  outcomes: { label: 'Résultats des litiges', field: 'outcome', max: 60 },
  carriers: { label: 'Transporteurs', field: 'carrier', max: 60 },
  carrierStages: { label: 'États du dossier transporteur', field: 'carrierStatus', max: 30 },
  clientStages: { label: 'Étapes côté client', field: 'clientStage', max: 30 },
};

// Valeurs utilisées par la logique de l'outil (relances, attente transporteur, décision…) :
// on peut en ajouter d'autres et changer l'ordre, mais pas les renommer ni les supprimer
export const LOCKED = {
  brands: ['MAGASIN'],
  carrierStages: [...carrierStages],
  clientStages: ['En attente réponse transporteur'],
};

export const DEFAULT_STAGES = {
  carrierStages: [...carrierStages],
  clientStages: [...clientStages],
};

const MAX_LENGTH = 120;

/**
 * Contrôle une mise à jour de liste. Renvoie { values, renames } ou { error }.
 * @param {string} key
 * @param {unknown} values nouvelle liste, dans l'ordre voulu
 * @param {unknown} renames [{ from, to }] valeurs renommées (pour les anciens dossiers)
 * @param {string[]} previous liste actuelle
 */
export function normalizeListUpdate(key, values, renames, previous = []) {
  const def = LIST_DEFS[key];
  if (!def) return { error: 'Liste inconnue.' };
  if (!Array.isArray(values)) return { error: 'Liste invalide.' };
  const clean = [];
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (!s) continue;
    if (s.length > MAX_LENGTH)
      return { error: 'Valeur trop longue (' + MAX_LENGTH + ' caractères au maximum).' };
    if (clean.some((c) => c.toLowerCase() === s.toLowerCase()))
      return { error: 'La valeur « ' + s + ' » apparaît deux fois.' };
    clean.push(s);
  }
  if (!clean.length) return { error: 'La liste doit contenir au moins une valeur.' };
  if (clean.length > def.max) return { error: def.max + ' valeurs au maximum.' };
  const locked = LOCKED[key] || [];
  const missing = locked.filter((l) => previous.includes(l) && !clean.includes(l));
  if (missing.length)
    return {
      error:
        '« ' + missing[0] + ' » est utilisé par l’outil : il ne peut être ni renommé ni supprimé.',
    };
  const list = [];
  for (const r of Array.isArray(renames) ? renames : []) {
    const from = String(r?.from ?? '').trim(),
      to = String(r?.to ?? '').trim();
    if (!from || !to || from === to) continue;
    if (locked.includes(from)) return { error: '« ' + from + ' » ne peut pas être renommé.' };
    if (!clean.includes(to))
      return { error: 'Renommage invalide : « ' + to + ' » absent de la liste.' };
    list.push({ from: from.slice(0, MAX_LENGTH), to });
  }
  if (list.length > 50) return { error: 'Trop de renommages à la fois.' };
  return { values: clean, renames: list };
}

// Texte d'historique d'un dossier renommé
export const renameText = (key, from, to) =>
  'Paramètres : ' +
  LIST_DEFS[key].label.toLowerCase() +
  ' renommé « ' +
  from +
  ' » → « ' +
  to +
  ' »';

// --- Couleurs des enseignes -----------------------------------------------------------------
export const DEFAULT_BRAND_COLORS = {
  CYBERTEK: '#111318',
  'CYBERTEK.PRO': '#4a4f5c',
  GROSBILL: '#d1202b',
  'GROSBILL.PRO': '#173a8a',
  PICATA: '#1d8a3e',
  BOULANGER: '#e2700b',
};

export const isColor = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

// Couleurs gardées pour les enseignes de la liste seulement
export function normalizeBrandColors(input, brands) {
  const out = {};
  for (const b of brands) if (isColor(input?.[b])) out[b] = String(input[b]).toLowerCase();
  return out;
}

// Version lisible sur fond sombre d'une couleur : même teinte, éclaircie
export function darkVariant(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  const l0 = l;
  l = Math.max(l, 0.72);
  // Noir, gris foncé ou couleur presque noire → presque blanc
  if (s < 0.08 || l0 < 0.15) l = Math.max(l, 0.94);
  const f = (p, q, t) => {
    t = (t + 1) % 1;
    return t < 1 / 6
      ? p + (q - p) * 6 * t
      : t < 1 / 2
        ? q
        : t < 2 / 3
          ? p + (q - p) * (2 / 3 - t) * 6
          : p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q;
  const hex2 = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return '#' + hex2(f(p, q, h + 1 / 3)) + hex2(f(p, q, h)) + hex2(f(p, q, h - 1 / 3));
}
