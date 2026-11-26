'use client';
import { useEffect } from 'react';

// Icône de l'onglet « oL » aux couleurs du thème choisi (bouton Apparence : clair Violet ou
// Ardoise, sombre Minuit ou Graphite, ou automatique). Le dégradé est celui des boutons
// principaux du thème affiché, lu sur la page : l'onglet suit donc toujours le thème. L'icône
// fixe app/icon.svg reste celle d'avant le chargement.
const rgb = /rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi;

function iconFor(from: string, to: string, ink: string) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    '</linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/>' +
    `<text x="31" y="45" text-anchor="middle" fill="${ink}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-weight="700" letter-spacing="-3">` +
    '<tspan font-size="40">o</tspan><tspan font-size="34">L</tspan></text></svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function refresh() {
  // Couleur d'accent du thème : celle des boutons principaux (bouton témoin, invisible)
  const probe = document.createElement('button');
  probe.className = 'primary';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
  // Dans la zone de travail, où s'appliquent les couleurs de chaque variante
  (document.querySelector('main') || document.body).appendChild(probe);
  const style = getComputedStyle(probe);
  const stops = style.backgroundImage.match(rgb) || [];
  const plain = style.backgroundColor;
  const ink = style.color || '#ffffff';
  probe.remove();
  const from = stops[0] || plain;
  const to = stops[stops.length - 1] || plain;
  if (!from || /rgba\(0, 0, 0, 0\)/.test(from)) return;
  const href = iconFor(from, to, ink);
  let links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
  if (!links.length) {
    const link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
    links = [link];
  }
  for (const link of links) {
    if (link.href === href) continue;
    link.type = 'image/svg+xml';
    link.href = href;
  }
}

export default function ThemeFavicon() {
  useEffect(() => {
    // Tout de suite, puis après le fondu de changement de thème (couleurs encore en transition)
    const later = () => {
      requestAnimationFrame(refresh);
      setTimeout(refresh, 500);
      setTimeout(refresh, 1300);
    };
    later();
    // Changement de thème (attributs data-theme / data-light / data-dark) ou du mode du système
    const observer = new MutationObserver(later);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-light', 'data-dark'],
    });
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', later);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', later);
    };
  }, []);
  return null;
}
