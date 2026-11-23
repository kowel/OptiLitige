# Mettre OptiLitige en ligne avec Supabase et Vercel

Cette copie d'OptiLitige fonctionne sans Cloudflare :

- **Supabase** garde la base (PostgreSQL), les pièces jointes (Storage) et gère la connexion Microsoft ;
- **Vercel** héberge le site.

Les écrans et les fonctions sont les mêmes que dans la version Cloudflare.

Comptez environ une heure, avec un administrateur Microsoft Entra pour l'étape 2. Les comptes Supabase et Vercel se créent au nom de l'entreprise, avec une adresse Cybertek.

## Ce qui change par rapport à la version Cloudflare

| Sujet | Version Cloudflare | Cette version |
| --- | --- | --- |
| Hébergement du site | Cloudflare Workers | Vercel (région Paris, `cdg1`) |
| Base de données | D1 (SQLite) | Supabase PostgreSQL |
| Pièces jointes | R2 | Supabase Storage, compartiment privé `pieces-jointes` |
| Connexion | Cloudflare Access + Entra | Supabase Auth + Entra (« Se connecter avec Microsoft ») |
| Pièces jointes de plus de 4,5 Mo | Envoyées au serveur | Envoyées directement du navigateur vers Supabase Storage, par une adresse signée par le serveur |
| Power BI | Jeton Power BI + jeton de service Access | Jeton Power BI seul |
| Serveur local | Wrangler | Next.js, avec une base PostgreSQL embarquée (PGlite), rien à installer |

Ce qui ne change pas :

- les données (mêmes tables, même contenu JSON) ;
- les rôles, les droits et « Équipe & accès » : un agent connecté doit toujours être autorisé par un admin ;
- les futurs e-mails Outlook (Microsoft Graph), qui marchent de la même façon sur les deux versions.

## Coûts indicatifs

| Service | Offre | Coût |
| --- | --- | --- |
| Supabase | Pro, conseillée : l'offre gratuite met le projet en pause après 7 jours sans activité, et elle n'a ni sauvegardes ni engagement de service | environ 25 $ par mois |
| Vercel | Pro, conseillée pour un usage professionnel : l'offre gratuite est réservée à un usage personnel et non commercial | environ 20 $ par mois et par membre qui déploie |

Les tarifs sont à confirmer sur les grilles de Supabase et de Vercel au moment de la mise en ligne.

## 1. Supabase

1. Créer un compte sur supabase.com avec une adresse Cybertek, puis une organisation « Cybertek ».
2. Créer le projet **OptiLitige** :
   - région **West EU (Paris)** ou **Central EU (Frankfurt)**, pour que les données restent en Europe ;
   - un mot de passe de base solide, à garder dans le coffre de mots de passe de l'informatique.
3. Dans **SQL Editor → New query**, coller le contenu de `supabase/migrations/20261123000000_optilitige.sql`, puis cliquer sur **Run**. Ce script :
   - crée les tables ;
   - bloque l'API publique de Supabase sur les tables ;
   - crée le compartiment privé `pieces-jointes`.
4. Noter les valeurs suivantes ; elles serviront à l'étape 3 :
   - **Connect → Connection String → Transaction pooler** (port 6543, adresse en `…pooler.supabase.com`) : c'est `DATABASE_URL`, avec le mot de passe de la base. Ne pas prendre la « Direct connection » (`db.….supabase.co`) : elle n'est joignable qu'en IPv6, donc ni depuis Vercel ni depuis la plupart des postes ;
   - **Project Settings → API** : `Project URL`, la clé `anon` (publique) et la clé `service_role` (secrète).
5. Dans **Storage → Settings**, régler la **taille maximale d'un fichier** à 100 Mo. Les envois depuis l'outil restent limités à 15 Mo, mais la reprise contient une pièce de 70 Mo.
6. Faire valider l'accord de traitement des données (DPA) de Supabase par l'entreprise (RGPD).

## 2. Connexion Microsoft (Entra ID), par l'administrateur Entra

1. Dans le portail Azure : **Microsoft Entra ID → App registrations → New registration**.
   - Nom : « OptiLitige ».
   - Comptes : « Accounts in this organizational directory only » (Cybertek seulement).
   - Redirect URI (Web) : `https://<projet>.supabase.co/auth/v1/callback`.
2. Dans **Certificates & secrets**, créer un secret client et noter sa valeur.
3. Dans **API permissions**, garder `User.Read`, puis ajouter les permissions déléguées `email`, `openid` et `profile`.
4. Dans Supabase, aller dans **Authentication → Sign In / Providers → Azure** :
   - activer le fournisseur ;
   - coller l'identifiant de l'application (client ID) et le secret ;
   - Azure Tenant URL : `https://login.microsoftonline.com/<identifiant du tenant Cybertek>`.
5. Dans Supabase, aller dans **Authentication → URL Configuration** :
   - Site URL : l'adresse du site, par exemple `https://litiges.cybertek.fr` ;
   - Redirect URLs : `https://litiges.cybertek.fr/auth/callback**` et, pour les essais, `https://<projet>.vercel.app/auth/callback**`. Les `**` finaux sont nécessaires : l'adresse de retour porte la page à rouvrir.
6. **Obligatoire** : dans **Authentication → Sign In / Providers**, désactiver l'inscription par e-mail (« Email ») et la connexion anonyme. Seule la connexion Microsoft doit exister. L'outil refuse de toute façon les comptes qui ne viennent pas de Microsoft.
7. Conseillé (offre Pro) : **Authentication → Sessions**, durée maximale de session de 8 h. L'outil déconnecte déjà après 2 h sans action.

## 3. Vercel

1. Créer un compte sur vercel.com, avec une équipe au nom de Cybertek. Relier le compte GitHub qui héberge le code.
2. **Add New → Project** : choisir le dépôt et la branche `version-supabase`. Le fichier `vercel.json` règle déjà le reste : Next.js, pnpm et la région Paris.
3. Dans **Settings → Environment Variables**, saisir les variables de `.env.exemple` :

   | Variable | Valeur |
   | --- | --- |
   | `DATABASE_URL` | Chaîne de connexion « Transaction pooler » (étape 1) |
   | `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role`, **jamais** dans une variable commençant par `NEXT_PUBLIC_` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé `anon` |
   | `AUTH_MODE` | `supabase` |
   | `ALLOWED_EMAIL_DOMAINS` | `cybertek.fr` |
   | `OWNER_EMAIL` | **Obligatoire** : adresse Microsoft du chef de projet (premier admin). Sans elle, l'outil reste fermé |
   | `APP_ORIGIN` | Adresse publique du site, sans `/` final, par exemple `https://litiges.cybertek.fr` |
   | `CRON_SECRET` | Texte aléatoire d'au moins 16 caractères : protège la tâche de nuit de la corbeille des pièces jointes (elle n'efface rien tant qu'un admin n'a pas activé le vidage) |
   | `SHIPMENTS_TOKEN`, `LAPOSTE_OKAPI_KEY`, `FEDEX_CLIENT_ID`, `FEDEX_CLIENT_SECRET` | Facultatives, comme dans la version Cloudflare. `SHIPMENTS_TOKEN` : au moins 24 caractères aléatoires |

   Cocher seulement l'environnement **Production** pour ces variables. Sinon, les aperçus de chaque branche utiliseraient la vraie base et la clé de service.

4. Cliquer sur **Deploy**.
5. Domaine : dans **Settings → Domains**, ajouter par exemple `litiges.cybertek.fr`, puis créer chez le gestionnaire du domaine l'enregistrement DNS indiqué par Vercel.

## 4. Reprendre les données de la version Cloudflare

Depuis le poste projet :

Les vrais dossiers sont dans la base du poste projet (`C:\OptiLitige`) : 1 025 dossiers corrigés, 157 contentieux, environ 2 900 pièces jointes (4,4 Go). Le jour de la bascule :

1. **Geler la saisie** dans l'outil local (plus personne n'y travaille).
2. Arrêter le serveur local de la version Cloudflare (`pnpm dev` dans `C:\OptiLitige`), puis faire une copie de sécurité du dossier `C:\OptiLitige\.wrangler\state` (base et pièces jointes du poste).
3. Vérifier d'abord ce qui sera envoyé, sans rien écrire :

   ```powershell
   node scripts/transfert-vers-supabase.mjs --source "<fichier .sqlite de C:\OptiLitige\.wrangler\state\v3\d1\miniflare-D1DatabaseObject>" --r2-local "C:\OptiLitige\.wrangler\state\v3\r2" --liste-seulement
   ```

   Attendu au 23/11/2026 : 2 864 pièces jointes, 4,39 Go. (Le fichier `.sqlite` à prendre est le plus gros du dossier.)
4. Dans `C:\OptiLitige-Supabase`, lancer le transfert avec les variables de l'étape 3 :

   ```powershell
   $env:DATABASE_URL = "<Transaction pooler>"; $env:SUPABASE_URL = "<Project URL>"; $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role>"; node scripts/transfert-vers-supabase.mjs --source "<même fichier .sqlite>" --r2-local "C:\OptiLitige\.wrangler\state\v3\r2" --remplacer
   ```

   Les pièces jointes sont lues directement dans le stockage du poste : seules celles encore rattachées à un dossier ou à un contentieux partent.

   Ce que fait le transfert :
   - il écarte le compte de test du poste (`seedy@sites.test`) et ses réglages ; le propriétaire en ligne est `OWNER_EMAIL` ;
   - il nettoie les caractères que PostgreSQL refuse, puis vérifie que chaque dossier se relit ;
   - il envoie les pièces jointes avec leur type (les photos s'affichent) et retente 3 fois chaque fichier ;
   - il est relançable : un fichier déjà présent avec la même taille n'est pas renvoyé. En cas de coupure, relancer la même commande **sans** `--remplacer`.

   Comptez de 30 minutes à 2 heures selon la connexion, pour 4,4 Go.
5. Les agents se connectent ensuite avec Microsoft. **L'admin les autorise un par un** dans « Équipe & accès » (les comptes ne sont pas repris du poste).

## 5. Vérifications après la mise en ligne

- [ ] La page d'accueil propose « Se connecter » et ouvre la page Microsoft de Cybertek.
- [ ] Une adresse hors `cybertek.fr` est refusée.
- [ ] Un agent non autorisé voit « Votre compte doit être autorisé par un admin ».
- [ ] Le chef de projet (`OWNER_EMAIL`) est Admin et voit « Équipe & accès ».
- [ ] Une photo de plus de 5 Mo s'ajoute à un dossier, puis s'ouvre.
- [ ] Une pièce jointe reprise du poste (photo ancienne) s'ouvre.
- [ ] Avec la clé `anon`, une lecture de `/rest/v1/records` renvoie une liste vide ou une erreur, jamais des dossiers.
- [ ] La déconnexion automatique après 2 h ramène bien à la connexion.
- [ ] Dans Vercel → **Cron Jobs**, la tâche `/api/cron/corbeille` apparaît ; un lancement manuel renvoie `ok` et `removed: 0` (vidage désactivé par défaut).
- [ ] La liste des dossiers s'ouvre en moins de 2 secondes.

## Limites connues et suites prévues

- **Taille de la liste** : l'outil charge tous les dossiers à l'ouverture (environ 1,6 Mo pour 1 000 dossiers). La réponse est envoyée en continu, ce qui doit éviter la limite de 4,5 Mo de Vercel. C'est à vérifier en ligne. Au-delà de 3 000 dossiers environ (dans un peu plus d'un an), il faudra ne charger d'office que les dossiers ouverts et récents.
- **Actualisation** : la liste se recharge chaque minute dans les onglets ouverts. Avec 15 agents, le trafic reste dans l'offre Pro de Supabase. À surveiller dans **Supabase → Usage** le premier mois.
- **Reprise SharePoint** : le script `scripts/reprise-sharepoint.mjs` (commentaires et pièces jointes d'origine) a été écrit pour la version Cloudflare. Il n'est pas nécessaire pour la bascule, puisque ces données sont déjà dans la base du poste.

## 6. Sauvegardes

- **Base** : avec l'offre Pro, Supabase sauvegarde chaque jour, et 7 jours sont gardés. La restauration à la minute près (PITR) est une option payante en plus.
- **Pièces jointes** : elles ne sont pas comprises dans ces sauvegardes. Il faut prévoir une copie régulière du compartiment `pieces-jointes`, avec l'informatique.
- **Corbeille** : une pièce jointe supprimée est rangée sous `corbeille/<date>/` et reste récupérable. **Par défaut, rien n'est jamais effacé.** Un admin peut activer le vidage automatique dans Paramètres → Corbeille des pièces jointes (30, 90, 180 ou 365 jours). La tâche de nuit `/api/cron/corbeille` applique alors ce réglage.

## En local (poste projet)

Il n'y a rien à installer en plus de Node.js et pnpm.

```powershell
pnpm install
```

```powershell
node scripts/transfert-vers-supabase.mjs --source "C:\OptiLitige\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\<fichier>.sqlite"
```

```powershell
pnpm dev
```

- Le transfert copie la base de test dans `.donnees-locales`, une base PostgreSQL embarquée.
- `pnpm dev` ouvre l'outil sur http://localhost:5173, avec une connexion simulée.
- Tests : `pnpm test`, `pnpm run test:api` et `pnpm run test:ui`. Ils tournent sur une copie de la base locale, dans `.donnees-tests`.
