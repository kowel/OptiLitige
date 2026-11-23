// Noms des types de la version Cloudflare, gardés pour ne pas réécrire les routes de l'API
declare global {
  type D1Database = import('./sql-db').SqlDatabase;
  type R2Bucket = import('./file-store').FileStore;
}
export {};
