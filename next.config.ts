import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Dossier de compilation (les tests utilisent le leur, scripts/serveur-tests.mjs)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Base PostgreSQL : pilote « pg » (Supabase) et PGlite (local), chargés tels quels par Node
  // Comme la version Cloudflare (vinext) : effets React exécutés une seule fois en développement
  reactStrictMode: false,
  // Pièces jointes : en ligne, envoi direct du navigateur vers Supabase Storage
  // (app/attachment-upload.ts, Vercel limitant les requêtes à 4,5 Mo) ; limites dans
  // app/attachment-rules.mjs.
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
};

export default nextConfig;
