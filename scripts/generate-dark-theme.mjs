// Génère app/theme-dark.generated.css : la version sombre de chaque couleur de globals.css.
// À relancer après une modification des couleurs de globals.css (pnpm run theme:dark).
// Les retouches faites à la main vivent dans app/theme-dark.css (chargé après ce fichier).
//
// Règles de conversion (teinte conservée, lumière inversée sur une courbe douce) :
//  - fond clair            → surface sombre (blanc → #161c2e environ) ; les fonds teintés
//                            (alerte jaune, erreur rouge, succès vert) restent teintés, en sombre ;
//  - fond déjà sombre      → inchangé (menu, messages de confirmation, caméra) ;
//  - texte foncé ou moyen  → texte clair (plus il était foncé, plus il devient clair) ;
//  - couleur d'accent      → même teinte, plus lumineuse (lisible sur fond sombre) ;
//  - bordure claire        → bordure sombre discrète.
import fs from 'node:fs';
import postcss from 'postcss';
import { fromHsl, hex, hexRe, named, parseHex, rgbRe, roleOf, toHsl } from './theme-colors.mjs';

const SRC = 'app/globals.css';
const OUT = 'app/theme-dark.generated.css';
const SCOPE = ":root[data-theme='dark']";

// --- couleurs (outils partagés : scripts/theme-colors.mjs) ---------------------------

function convert(c, role) {
  const { h, s, l } = toHsl(c);
  const a = c.a ?? 1;
  // transparences blanches légères (reflets sur le menu) et ombres noires : inchangées
  if (a < 1 && l > 0.95) return null;
  if (role === 'line' && l < 0.25) return null;
  // Quasi-blancs : leur « saturation » n'est qu'un reflet, ils deviennent neutres (bleu nuit) ;
  // seuls les fonds vraiment teintés (alerte, erreur, succès, sélection) gardent leur couleur
  const neutral = s < 0.05 || (l > 0.955 && s < 0.6) || l > 0.985;
  if (role === 'bg') {
    if (l < 0.42) return null; // fond déjà sombre
    const tinted = !neutral && s > 0.45;
    // Fonds un peu moins sombres (blanc → environ #1c2338) pour un meilleur confort de lecture
    const nl = tinted ? 0.2 + (1 - l) * 0.35 : 0.175 + (1 - l) * 0.5;
    const ns = tinted ? Math.min(s, 0.42) : Math.min(s, 0.32) * 0.75;
    return hex(fromHsl({ h: neutral ? 228 : h, s: neutral ? 0.28 : ns, l: nl }), a);
  }
  if (role === 'line') {
    if (l > 0.8)
      return hex(
        fromHsl({
          h: neutral ? 228 : h,
          s: neutral ? 0.26 : Math.min(s, 0.3) * 0.8 + 0.08,
          l: 0.26 + (1 - l) * 0.5,
        }),
        a,
      );
    if (s > 0.4) return hex(fromHsl({ h, s, l: Math.max(l, 0.7) }), a); // bordure d'accent
    return hex(fromHsl({ h, s: Math.min(s, 0.3), l: 0.4 }), a);
  }
  // texte
  if (l > 0.82) return null; // déjà clair (texte sur fond sombre)
  if (s > 0.4 && l > 0.25 && l < 0.7)
    return hex(fromHsl({ h, s: Math.min(1, s * 1.05), l: Math.max(0.76, l + 0.24) }), a); // accent
  return hex(fromHsl({ h, s: Math.min(s, 0.35), l: Math.min(0.95, 0.98 - l * 0.4) }), a); // textes secondaires plus contrastés
}

function transformValue(value, role) {
  let changed = false;
  let out = value.replace(/\b(white|black)\b/g, (m) => {
    const r = convert(parseHex(named[m]), role);
    if (r) changed = true;
    return r || m;
  });
  out = out.replace(hexRe, (m) => {
    const r = convert(parseHex(m), role);
    if (r) changed = true;
    return r || m;
  });
  out = out.replace(rgbRe, (m, r, g, b, a) => {
    const alpha = a ? (a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a)) : 1;
    const res = convert({ r: +r, g: +g, b: +b, a: alpha }, role);
    if (res) changed = true;
    return res || m;
  });
  return changed ? out : null;
}

// --- parcours de la feuille -------------------------------------------------------------
const root = postcss.parse(fs.readFileSync(SRC, 'utf8'));
const out = postcss.root();
let count = 0;
root.walkRules((rule) => {
  // impression : toujours en clair ; @keyframes : ignorés
  for (let p = rule.parent; p; p = p.parent)
    if (p.type === 'atrule' && (/print/.test(p.params) || /keyframes/.test(p.name))) return;
  if (rule.selector.startsWith(':root')) return; // variables : retouchées à la main
  const decls = [];
  rule.each((d) => {
    if (d.type !== 'decl') return;
    const role = roleOf(d.prop);
    if (!role) return;
    const v = transformValue(
      d.value,
      d.prop === 'background' && /gradient/.test(d.value) ? 'bg' : role,
    );
    if (v) decls.push(postcss.decl({ prop: d.prop, value: v, important: d.important }));
  });
  if (!decls.length) return;
  const selector = rule.selectors
    .map((s) =>
      s.trim() === 'body' || s.trim() === 'html'
        ? SCOPE + ' ' + s.trim().replace(/^html/, '')
        : SCOPE + ' ' + s.trim(),
    )
    .join(',\n');
  const copy = postcss.rule({ selector });
  decls.forEach((d) => copy.append(d));
  // conserve les @media d'écran (téléphone, survol…) autour de la règle
  let target = copy;
  for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) {
    target = postcss.atRule({ name: p.name, params: p.params }).append(target);
  }
  out.append(target);
  count += decls.length;
});

fs.writeFileSync(
  OUT,
  '/* Fichier généré par scripts/generate-dark-theme.mjs à partir de globals.css : ne pas modifier.\n' +
    '   Retouches manuelles du mode sombre : app/theme-dark.css. */\n' +
    // À l'écran seulement : l'impression (fiche PDF) reste en clair
    '@media screen {\n' +
    out.toString() +
    '\n}\n',
);
console.log(count + ' couleurs converties → ' + OUT);
