// Outils de couleur partagés par les générateurs de thèmes (generate-dark-theme.mjs,
// generate-theme-variants.mjs) : lecture des couleurs CSS, passage en teinte / saturation /
// lumière (HSL) et retour en hexadécimal.
export const hexRe = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
export const rgbRe = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/gi;
export const named = { white: '#ffffff', black: '#000000' };

export function parseHex(h) {
  let s = h.slice(1);
  if (s.length <= 4) s = [...s].map((c) => c + c).join('');
  const n = (i) => parseInt(s.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: s.length === 8 ? n(6) / 255 : 1 };
}
export function toHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min,
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
export function fromHsl({ h, s, l }) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const k = (n) => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}
export const hex = ({ r, g, b }, a = 1) =>
  '#' +
  [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('') +
  (a < 1
    ? Math.round(a * 255)
        .toString(16)
        .padStart(2, '0')
    : '');

/** Applique fn({h,s,l}, alpha) → {h,s,l} | null à chaque couleur d'une valeur CSS */
export function mapColors(value, fn) {
  const one = (c) => {
    const r = fn(toHsl(c), c.a ?? 1);
    return r ? hex(fromHsl(r), c.a ?? 1) : null;
  };
  let out = value.replace(/\b(white|black)\b/g, (m) => one(parseHex(named[m])) || m);
  out = out.replace(hexRe, (m) => one(parseHex(m)) || m);
  out = out.replace(rgbRe, (m, r, g, b, a) => {
    const alpha = a ? (a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a)) : 1;
    return one({ r: +r, g: +g, b: +b, a: alpha }) || m;
  });
  return out;
}

// Rôle d'une propriété : fond, trait (bordure, ombre…) ou texte
export function roleOf(prop) {
  if (/^(background|background-color|background-image)$/.test(prop)) return 'bg';
  if (
    /^(border|border-(top|right|bottom|left)(-color)?|border-color|outline(-color)?|box-shadow|text-decoration(-color)?|stroke)$/.test(
      prop,
    )
  )
    return 'line';
  if (/^(color|fill|caret-color)$/.test(prop)) return 'text';
  return null;
}
