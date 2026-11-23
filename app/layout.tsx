import './globals.css';
// Mode sombre : conversion automatique des couleurs, puis retouches à la main
import './theme-dark.generated.css';
import './theme-dark.css';
// Variantes au choix (bouton Apparence) : sombre Minuit / Graphite, clair Violet / Ardoise
import './theme-variants.generated.css';
export const metadata = {
  title: 'OptiLitige • Litiges SAV',
  description: 'Votre espace de résolution des litiges SAV et transport.',
};
// Applique le thème choisi (Clair / Sombre / Auto, et la variante de chacun) avant le premier affichage, pour éviter
// un éclair blanc ; voir app/theme-toggle.tsx.
const themeScript = `try{var c=localStorage.getItem('optilitige-theme');var d=c==='dark'||(c!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var h=document.documentElement;h.dataset.theme=d?'dark':'light';if(localStorage.getItem('optilitige-light')==='ardoise')h.dataset.light='ardoise';if(localStorage.getItem('optilitige-dark')==='graphite')h.dataset.dark='graphite'}catch(e){}`;
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
