-- OptiLitige : tables et stockage dans Supabase.
-- À exécuter une fois dans Supabase (SQL Editor → New query → coller → Run), ou avec
-- « supabase db push ». Relançable sans risque.

-- 1. Tables (les mêmes que la version Cloudflare : le contenu des dossiers est en JSON)
CREATE TABLE IF NOT EXISTS public.members (
  email text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  role text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.records (
  id text PRIMARY KEY NOT NULL,
  payload text NOT NULL,
  version integer DEFAULT 1 NOT NULL
);
CREATE TABLE IF NOT EXISTS public.settings (
  id text PRIMARY KEY NOT NULL,
  payload text NOT NULL
);
-- Recherches par début d'identifiant (« notification-read:… », « access-log:… »,
-- « contentieux:… ») à chaque ouverture de l'outil : comparaison octet par octet indexée
CREATE INDEX IF NOT EXISTS settings_id_c ON public.settings (id COLLATE "C");

-- 2. Sécurité : seul le serveur d'OptiLitige lit et écrit, par la connexion directe à la base
-- (DATABASE_URL). L'API publique de Supabase (clé « anon », visible dans le navigateur) n'a
-- accès à rien : sécurité par ligne activée, sans aucune règle d'accès, et droits retirés.
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.members, public.records, public.settings FROM anon, authenticated;

-- 3. Pièces jointes : compartiment privé (jamais public), lu et écrit par le serveur avec la
-- clé de service ; les envois du navigateur passent par des adresses signées par le serveur.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('pieces-jointes', 'pieces-jointes', false, 104857600)
ON CONFLICT (id) DO NOTHING;
