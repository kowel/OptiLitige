// Fichier PDF du rapport, fabriqué directement dans le navigateur (aucune bibliothèque) :
// page A4, polices standard Helvetica, barres et flèches dessinées en vectoriel. Le contenu est
// le même que l'aperçu à l'écran (reportTiles, reportRanks, REPORT_NOTE de app/reports.mjs).
import { REPORT_NOTE, reportRanks, reportTiles } from './reports.mjs';

const W = 595.28,
  H = 841.89,
  M = 40;

// Caractères Unicode → octets WinAnsi (accents français, €, guillemets…)
const WIN = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};
function winAnsi(text) {
  const out = [];
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    if (ch === ' ' || ch === ' ')
      out.push(0x20); // espaces fines (nombres en français)
    else if (WIN[ch]) out.push(WIN[ch]);
    else if (c < 256) out.push(c);
    else out.push(0x3f); // « ? » pour un caractère impossible à écrire
  }
  return out;
}
// Chaîne PDF entre parenthèses, échappée
const pdfString = (text) =>
  '(' +
  winAnsi(text)
    .map((b) =>
      b === 0x28 || b === 0x29 || b === 0x5c
        ? '\\' + String.fromCharCode(b)
        : b < 32 || b > 126
          ? '\\' + b.toString(8).padStart(3, '0')
          : String.fromCharCode(b),
    )
    .join('') +
  ')';

// Largeurs Helvetica (pour 1000 unités) : chiffres et signes courants exacts, le reste estimé
const WIDTHS = {
  ' ': 278,
  0: 556,
  1: 556,
  2: 556,
  3: 556,
  4: 556,
  5: 556,
  6: 556,
  7: 556,
  8: 556,
  9: 556,
  ',': 278,
  '.': 278,
  '%': 889,
  '€': 556,
  '(': 333,
  ')': 333,
  '·': 278,
  '-': 333,
  '/': 278,
  ':': 278,
  i: 222,
  l: 222,
  j: 222,
  f: 278,
  t: 278,
  r: 333,
  m: 833,
  w: 722,
  I: 278,
  M: 833,
  W: 944,
};
export const textWidth = (text, size, bold = false) =>
  [...String(text)].reduce((n, ch) => n + (WIDTHS[ch] ?? (/[A-Z]/.test(ch) ? 667 : 556)), 0) *
  (size / 1000) *
  (bold ? 1.05 : 1);

// Coupe un texte en lignes qui tiennent dans la largeur donnée
function wrap(text, size, width) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = line ? line + ' ' + word : word;
    if (textWidth(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
// Raccourcit un texte trop long avec « … »
function fit(text, size, width, bold) {
  let t = String(text);
  if (textWidth(t, size, bold) <= width) return t;
  while (t.length > 1 && textWidth(t + '…', size, bold) > width) t = t.slice(0, -1);
  return t + '…';
}

const rgb = (hex) =>
  [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
const PURPLE = '#7160db',
  INK = '#1f1d2b',
  GREY = '#777777',
  LINE = '#e8e5f0',
  GREEN = '#2f9467',
  RED = '#c2414b';

/**
 * PDF du rapport, sous forme d'octets. Indicateurs, classements et note : ceux des litiges par
 * défaut, ou ceux fournis (rapport des contentieux, app/contentieux.mjs).
 * @param {{ title: string, data: any, edited?: Date, tiles?: any[], ranks?: any[], note?: string, empty?: string }} options
 * @returns {Uint8Array}
 */
export function reportPdf({
  title,
  data,
  edited = new Date(),
  tiles = reportTiles(data),
  ranks = reportRanks(data),
  note = REPORT_NOTE,
  empty = 'Tous les dossiers',
}) {
  const ops = [];
  // y mesuré depuis le haut de la page (plus lisible), converti pour le PDF
  const Y = (y) => (H - y).toFixed(2);
  const text = (x, y, str, { size = 10, bold = false, color = INK, align = 'left' } = {}) => {
    const w = textWidth(str, size, bold);
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    ops.push(
      'BT /' +
        (bold ? 'F2' : 'F1') +
        ' ' +
        size +
        ' Tf ' +
        rgb(color) +
        ' rg ' +
        left.toFixed(2) +
        ' ' +
        Y(y) +
        ' Td ' +
        pdfString(str) +
        ' Tj ET',
    );
  };
  const rect = (x, y, w, h, { fill, stroke } = {}) => {
    if (fill)
      ops.push(
        rgb(fill) +
          ' rg ' +
          x.toFixed(2) +
          ' ' +
          Y(y + h) +
          ' ' +
          w.toFixed(2) +
          ' ' +
          h.toFixed(2) +
          ' re f',
      );
    if (stroke)
      ops.push(
        '0.8 w ' +
          rgb(stroke) +
          ' RG ' +
          x.toFixed(2) +
          ' ' +
          Y(y + h) +
          ' ' +
          w.toFixed(2) +
          ' ' +
          h.toFixed(2) +
          ' re S',
      );
  };
  const triangle = (x, y, up, color) => {
    const s = 3.2;
    const pts = up
      ? [
          [x, y - s],
          [x - s, y + s * 0.8],
          [x + s, y + s * 0.8],
        ]
      : [
          [x, y + s],
          [x - s, y - s * 0.8],
          [x + s, y - s * 0.8],
        ];
    ops.push(
      rgb(color) +
        ' rg ' +
        pts.map(([a, b], i) => a.toFixed(2) + ' ' + Y(b) + (i ? ' l' : ' m')).join(' ') +
        ' h f',
    );
  };

  // En-tête
  let y = M + 6;
  text(M, y, 'OPTILITIGE · GROUPE CYBERTEK', { size: 8, bold: true, color: PURPLE });
  y += 24;
  text(M, y, fit(title, 20, W - 2 * M, true), { size: 20, bold: true });
  y += 18;
  const label = data.period.label.charAt(0).toUpperCase() + data.period.label.slice(1);
  text(M, y, label + ' · comparé à ' + data.previous.label, { size: 10, color: '#555555' });
  y += 14;
  const filters = data.filters.length ? 'Filtres : ' + data.filters.join(' · ') : empty;
  for (const l of wrap(
    filters + ' · Édité le ' + edited.toLocaleDateString('fr-FR'),
    8,
    W - 2 * M,
  )) {
    text(M, y, l, { size: 8, color: '#888888' });
    y += 11;
  }
  y += 2;
  rect(M, y, W - 2 * M, 2.5, { fill: PURPLE });
  y += 16;

  // Indicateurs : 3 colonnes × 3 lignes
  const gap = 8,
    tw = (W - 2 * M - 2 * gap) / 3,
    th = 54;
  tiles.forEach((t, i) => {
    const x = M + (i % 3) * (tw + gap),
      top = y + Math.floor(i / 3) * (th + gap);
    rect(x, top, tw, th, { stroke: LINE });
    text(x + 10, top + 15, fit(t.label, 8, tw - 20), { size: 8, color: GREY });
    text(x + 10, top + 33, fit(t.value, 14, tw - 20, true), { size: 14, bold: true });
    const color = t.delta.tone === 'better' ? GREEN : t.delta.tone === 'worse' ? RED : '#888888';
    if (t.delta.dir) {
      triangle(x + 13, top + 44, t.delta.dir === 'up', color);
      text(x + 20, top + 47, t.delta.text, { size: 8, color });
    } else text(x + 10, top + 47, t.delta.text, { size: 8, color });
  });
  y += 3 * th + 2 * gap + 22;

  // Classements : 2 colonnes × 2 lignes
  const cw = (W - 2 * M - 26) / 2;
  let rowBottom = y;
  ranks.forEach((r, i) => {
    const x = M + (i % 2) * (cw + 26);
    if (i % 2 === 0) y = rowBottom;
    let top = y;
    text(x, top, fit(r.title, 10, cw, true), { size: 10, bold: true });
    top += 8;
    if (!r.rows.length) {
      text(x, top + 12, 'Aucun dossier.', { size: 9, color: GREY });
      top += 20;
    }
    for (const [k, v] of r.rows) {
      top += 15;
      ops.push(
        '0.5 w ' +
          rgb('#f0eef5') +
          ' RG ' +
          x.toFixed(2) +
          ' ' +
          Y(top + 4) +
          ' m ' +
          (x + cw).toFixed(2) +
          ' ' +
          Y(top + 4) +
          ' l S',
      );
      text(x, top, fit(k, 9, cw * 0.5), { size: 9, color: '#333333' });
      text(x + cw * 0.62, top, String(v), { size: 9, bold: true, align: 'right' });
      const bw = cw * 0.34 * (r.total ? v / r.total : 0);
      rect(x + cw * 0.66, top - 6, Math.max(bw, v ? 1.5 : 0), 6, { fill: '#9a88e8' });
    }
    rowBottom = Math.max(rowBottom, top + 26);
  });
  y = rowBottom;

  // Note de lecture en bas de page
  y = Math.max(y, H - M - 40);
  ops.push(
    '0.5 w ' +
      rgb('#eeeeee') +
      ' RG ' +
      M +
      ' ' +
      Y(y - 8) +
      ' m ' +
      (W - M).toFixed(2) +
      ' ' +
      Y(y - 8) +
      ' l S',
  );
  for (const l of wrap(note, 7, W - 2 * M)) {
    text(M, y + 2, l, { size: 7, color: '#888888' });
    y += 9;
  }

  // Assemblage du fichier (objets, table des positions, fin de fichier)
  const content = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
      W +
      ' ' +
      H +
      '] ' +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
    '<< /Title ' + pdfString(title + ' - ' + data.period.label) + ' /Producer (OptiLitige) >>',
  ];
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += i + 1 + ' 0 obj\n' + o + '\nendobj\n';
  });
  const xref = out.length;
  out +=
    'xref\n0 ' +
    (objects.length + 1) +
    '\n0000000000 65535 f \n' +
    offsets.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
    'trailer\n<< /Size ' +
    (objects.length + 1) +
    ' /Root 1 0 R /Info 7 0 R >>\nstartxref\n' +
    xref +
    '\n%%EOF\n';
  // Tout le contenu est en octets 0-255 (texte converti en WinAnsi) : copie octet par octet
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

// Téléchargement du fichier dans le navigateur
export function downloadPdf(bytes, fileName) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
