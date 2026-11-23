// Nom d'enseigne en couleur, pour la repérer d'un coup d'œil (fiche, listes, statistiques) :
// CYBERTEK noir · CYBERTEK.PRO gris foncé · GROSBILL rouge · GROSBILL.PRO bleu foncé ·
// PICATA vert · BOULANGER orange. Couleurs dans app/globals.css (et app/theme-dark.css).

// « CYBERTEK.PRO », « Cybertek Pro », « cybertek-pro » → « cybertek-pro »
export function brandKey(brand?: string | null) {
  return String(brand || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function BrandName({
  brand,
  store,
}: {
  brand?: string | null;
  store?: string | null;
}) {
  const key = brandKey(brand);
  return (
    <span className="brand-name" data-brand={key}>
      {brand || 'Non renseignée'}
      {store ? <span className="brand-store"> · {store}</span> : null}
    </span>
  );
}
