# OptiLitige

Outil web de gestion des **litiges SAV et transport** du Groupe Cybertek : création des dossiers par la RC et le SAV, traitement par le Service Litige, échanges avec les transporteurs, avoirs, contentieux, analyses et tableaux de bord.

Cette version est faite pour **Supabase** (base, fichiers, connexion Microsoft) et **Vercel** (hébergement du site).

## Technologies

| Rôle | Outil |
| --- | --- |
| Site et API | Next.js 16 (App Router), React, TypeScript |
| Base de données | PostgreSQL chez Supabase (tables `members`, `records`, `settings`, contenu en JSON) |
| Pièces jointes | Supabase Storage, compartiment privé `pieces-jointes` |
| Connexion | Supabase Auth avec Microsoft Entra ID (« Se connecter avec Microsoft ») |
| Hébergement | Vercel, région Paris (`cdg1`) |
| En local | Base PostgreSQL embarquée (PGlite) et fichiers dans `.donnees-locales/`, rien à installer |

## Lancer en local

Il faut Node.js 22 ou plus récent, et pnpm.

```powershell
pnpm install
```

```powershell
pnpm dev
```

- L'outil s'ouvre sur http://localhost:5173, d'abord en **démonstration** (données fictives).
- Le bouton « Accéder à mon espace réel » ouvre la base locale avec une connexion simulée (`seedy@sites.test`). Cette connexion simulée est refusée en production.
- Pour partir de la base de la version Cloudflare : `pnpm run transfert-supabase -- --source "<fichier .sqlite ou base.sql>"` (voir le mode d'emploi, § 4).

Pour brancher l'outil local sur un projet Supabase, il faut définir les variables `DATABASE_URL`, `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` (modèle : `.env.exemple`). Sans ces variables, l'outil utilise la base embarquée.

## Tests

| Commande | Ce qui est testé |
| --- | --- |
| `pnpm test` | Règles métier et accès à la base |
| `pnpm run test:api` | API, sur une copie de la base locale (port 5174) |
| `pnpm run test:ui` | Écrans, avec Playwright, sur la même copie |
| `npx tsc --noEmit -p .` | Types |
| `pnpm run lint` | Qualité du code |

La base locale de référence n'est jamais modifiée par les tests.

## Mise en ligne

Tout est décrit dans **[DEPLOIEMENT-SUPABASE-VERCEL.md](DEPLOIEMENT-SUPABASE-VERCEL.md)** :
- création du projet Supabase (script `supabase/migrations/…sql`) ;
- application Entra ;
- projet Vercel et variables ;
- transfert des données et des pièces jointes ;
- vérifications ;
- sauvegardes et coûts.

## Organisation du code

| Fichier ou dossier | Contenu |
| --- | --- |
| `app/page.tsx` | Tout l'écran : liste, fiche, traitement, création, paramètres |
| `app/api/data/route.ts` | API principale : lecture et actions sur les dossiers |
| `app/api/attachments/route.ts` | Pièces jointes, avec envoi direct vers Supabase Storage (limite de 4,5 Mo par requête chez Vercel) |
| `app/auth.ts`, `app/auth/*` | Connexion : Supabase et Microsoft, ou simulée en local |
| `app/server/env.ts` | Accès à la base (bibliothèque `pg` en ligne, PGlite en local) et au stockage |
| `app/server/sql-db.ts` | Couche d'accès à la base (`prepare`, `bind`, `first`, `all`, `run`, `batch`) |
| `app/*.mjs` | Règles métier testées : délais, étapes, imputations, filtres, avoirs… |
| `supabase/migrations/` | Tables, sécurité (API publique fermée) et compartiment des pièces jointes |
| `scripts/transfert-vers-supabase.mjs` | Reprise des données de la version Cloudflare |
| `scripts/reprise-sharepoint.mjs` | Import de la liste SharePoint « Dépot Litiges VPC » |
| `tests/` | Tests des règles, de l'API et des écrans |

## Sécurité

- **Clé `service_role` de Supabase** : elle reste côté serveur. Ne jamais la mettre dans une variable `NEXT_PUBLIC_…`.
- **Connexion** : seules les adresses des domaines de `ALLOWED_EMAIL_DOMAINS` sont acceptées. Un agent connecté doit en plus être autorisé par un admin dans « Équipe & accès ».
- **Base** : la sécurité par ligne (RLS) est activée, sans aucune règle d'accès. L'API publique de Supabase ne lit donc aucun dossier.
- **Jamais dans le dépôt** : fichiers `.env*` (sauf `.env.exemple`), `.donnees-locales/` et données réelles.

## Documents liés

| Document | Contenu |
| --- | --- |
| [DEPLOIEMENT-SUPABASE-VERCEL.md](DEPLOIEMENT-SUPABASE-VERCEL.md) | Mise en ligne pas à pas |
| [REPRISE.md](REPRISE.md) | Reprise rapide : lancer, tester, règles métier, points ouverts |
| [POINT_REPRISE.md](POINT_REPRISE.md) | Journal détaillé du projet |
| [A-FINALISER-AVEC-IT.md](A-FINALISER-AVEC-IT.md) | Ce qui dépend de l'informatique et du DPO |
| [Guide de prise en main](https://claude.ai/artifact/93Bfgn2h3Zxv5yJ5PpSHRW) | Guide utilisateur illustré |
