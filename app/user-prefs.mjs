// Préférences d'affichage propres à chaque compte : format de chaque graphique et ordre des
// graphiques par écran (Analyses & rapports, vues d'ensemble). Enregistrées côté serveur
// (settings « prefs:<e-mail> »), elles suivent l'agent sur tous ses appareils.

export const CHART_FORMATS = ['bars', 'columns', 'donut', 'pie', 'table', 'line', 'days', 'weeks'];
const ID = /^[\w:.-]{1,60}$/;

// Nettoie des préférences reçues ; renvoie { prefs } ou { error }
export function normalizePrefs(input) {
  const charts = {},
    layouts = {};
  const c = input?.charts || {},
    l = input?.layouts || {};
  if (Object.keys(c).length > 60 || Object.keys(l).length > 30)
    return { error: 'Trop de préférences.' };
  for (const [k, v] of Object.entries(c)) {
    if (!ID.test(k) || !CHART_FORMATS.includes(v))
      return { error: 'Format de graphique invalide.' };
    charts[k] = v;
  }
  for (const [k, v] of Object.entries(l)) {
    if (!ID.test(k) || !Array.isArray(v) || v.length > 40 || v.some((x) => !ID.test(String(x))))
      return { error: 'Disposition invalide.' };
    layouts[k] = v.map(String);
  }
  return { prefs: { charts, layouts } };
}
