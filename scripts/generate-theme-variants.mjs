// Génère app/theme-variants.generated.css : les variantes de couleurs au choix de chaque agent
// (bouton Apparence, en haut à droite). À relancer après une modification des couleurs
// (pnpm run theme:dark relance les deux générateurs).
//
//  - Sombre « Minuit » (par défaut) : bleu nuit profond, plus contrasté. Il s'applique par-dessus
//    le mode sombre de base (theme-dark.generated.css + theme-dark.css), mêmes sélecteurs.
//  - Sombre « Graphite » (<html data-dark="graphite">) : gris anthracite neutre, accent violet.
//  - Clair « Ardoise » (<html data-light="ardoise">) : gris-bleu sobre, accent indigo.
//  - Clair « Violet » : le thème de globals.css, sans surcharge.
//
// Seules les teintes de la marque (violet / bleu nuit) changent : rouge des erreurs, vert des
// réussites, jaune des alertes et couleurs des enseignes restent identiques. Chaque variante
// reprend toutes les déclarations de couleur dans leur ordre d'origine, pour que la règle qui
// gagnait avant gagne encore.
import fs from 'node:fs';
import postcss from 'postcss';
import { mapColors, roleOf } from './theme-colors.mjs';

const OUT = 'app/theme-variants.generated.css';
const DARK = ":root[data-theme='dark']";
const LIGHT_FILES = ['app/globals.css'];
const DARK_FILES = ['app/theme-dark.generated.css', 'app/theme-dark.css'];

const inBrand = (h, s) => s > 0.02 && h >= 205 && h <= 300;
const darkBrand = (h, s) => inBrand(h, s) || (s > 0.02 && h >= 180 && h < 205);
const isAccent = (s, l) => s > 0.4 && l > 0.3;

const VARIANTS = {
  minuit: ({ h, s, l }) => {
    if (!darkBrand(h, s)) return null;
    if (isAccent(s, l)) return { h: h - 8, s: Math.min(1, s * 1.1), l: Math.min(0.85, l * 1.03) };
    return { h: 226, s: Math.min(0.45, s * 1.15), l: l < 0.4 ? l * 0.62 : l };
  },
  graphite: ({ h, s, l }) => {
    if (!darkBrand(h, s)) return null;
    if (isAccent(s, l)) return { h, s, l };
    return { h: 235, s: Math.min(s, 0.3) * 0.22, l: l < 0.4 ? l * 0.78 : l };
  },
  ardoise: ({ h, s, l }) => {
    if (!inBrand(h, s)) return null;
    if (s > 0.45 && l > 0.3 && l < 0.8) return { h: 232, s: s * 0.8, l: l * 0.92 };
    // gris des textes secondaires un peu plus foncés : au moins aussi lisibles qu'en violet
    return { h: 222, s: s * 0.35, l: l > 0.45 && l < 0.8 ? l * 0.9 : l };
  },
};

// Déclarations de couleur (fond, trait, texte, variables) des règles d'écran, dans l'ordre
function colorRules(files, rewrite, fn) {
  const out = postcss.root();
  for (const f of files) {
    postcss.parse(fs.readFileSync(f, 'utf8')).walkRules((rule) => {
      for (let p = rule.parent; p; p = p.parent)
        if (p.type === 'atrule' && (/print/.test(p.params) || /keyframes/.test(p.name))) return;
      const selector = rewrite(rule.selectors);
      if (!selector) return;
      const decls = [];
      rule.each((d) => {
        if (d.type !== 'decl') return;
        const custom = d.prop.startsWith('--') && /#|rgb|white|black/.test(d.value);
        if (!custom && !roleOf(d.prop)) return;
        decls.push(
          postcss.decl({ prop: d.prop, value: mapColors(d.value, fn), important: d.important }),
        );
      });
      if (!decls.length) return;
      let target = postcss.rule({ selector });
      decls.forEach((d) => target.append(d));
      for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent)
        if (!(p.name === 'media' && p.params === 'screen'))
          target = postcss.atRule({ name: p.name, params: p.params }).append(target);
      out.append(target);
    });
  }
  return out.toString();
}

// Sélecteurs du mode sombre : préfixe remplacé (ex. Graphite) ou gardé tel quel (Minuit)
const darkScope = (scope) => (selectors) => {
  const kept = selectors.filter((s) => s.trim().startsWith(DARK));
  return kept.length ? kept.map((s) => scope + s.trim().slice(DARK.length)).join(',\n') : null;
};
// Sélecteurs du mode clair : placés sous :root[data-theme='light'][data-light='…']
const lightScope = (scope) => (selectors) =>
  selectors
    .map((s) => {
      s = s.trim();
      if (s.startsWith(':root')) return scope + s.slice(5);
      if (s === 'html' || s.startsWith('html ')) return scope + s.slice(4);
      return scope + ' ' + s;
    })
    .join(',\n');

{
  const parts = [
    '/* Fichier généré par scripts/generate-theme-variants.mjs : ne pas modifier.\n' +
      '   Variantes au choix (bouton Apparence) : sombre Minuit (défaut) ou Graphite, clair Violet\n' +
      "   (défaut, globals.css) ou Ardoise. À l'écran seulement : l'impression reste en clair. */",
    '@media screen {',
    '/* ---- Sombre Minuit (par défaut) ---- */',
    colorRules(DARK_FILES, darkScope(DARK), VARIANTS.minuit),
    '/* ---- Sombre Graphite ---- */',
    colorRules(DARK_FILES, darkScope(DARK + "[data-dark='graphite']"), VARIANTS.graphite),
    '/* ---- Clair Ardoise ---- */',
    colorRules(
      LIGHT_FILES,
      lightScope(":root[data-theme='light'][data-light='ardoise']"),
      VARIANTS.ardoise,
    ),
    '}',
  ];
  fs.writeFileSync(OUT, parts.join('\n') + '\n');
  console.log('Variantes Minuit, Graphite et Ardoise → ' + OUT);
}
