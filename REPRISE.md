# OptiLitige — reprise rapide

Outil des litiges SAV / transport de Groupe Cybertek, **version Supabase + Vercel** : Next.js 16, base PostgreSQL (Supabase ; PGlite embarqué en local), pièces jointes dans Supabase Storage, connexion Microsoft par Supabase Auth. Détails : `README.md`, `DEPLOIEMENT-SUPABASE-VERCEL.md`, `POINT_REPRISE.md` (journal), `A-FINALISER-AVEC-IT.md`.

La version Cloudflare (Workers, D1, R2, Access) reste dans le dépôt `Litigerc` ; ce dépôt (`optilitige`) ne contient que la version Supabase.

## Lancer et tester

- Lancer en local : `pnpm dev`, puis http://localhost:5173. L'outil s'ouvre en démonstration ; « Accéder à mon espace réel » ouvre la base locale `.donnees-locales` (connexion simulée `seedy@sites.test`). Le serveur s'arrête si son terminal est fermé.
- Brancher l'outil local sur un projet Supabase : variables `DATABASE_URL` (« Transaction pooler », port 6543, jamais la connexion directe `db.….supabase.co`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Tests : `pnpm test` (logique), `pnpm run test:api` (API), `pnpm run test:ui` (Playwright/Edge). Les deux derniers démarrent seuls un site de test sur une copie de la base (port 5174) : la base de référence n'est jamais modifiée. Puis `npx tsc --noEmit -p .` et `pnpm run lint`.
- Après un changement visuel : `node scripts/generate-dark-theme.mjs` (thème sombre), `pnpm run captures-guide`. Reprise de la base Cloudflare : `pnpm run transfert-supabase -- --source <.sqlite ou base.sql> [--fichiers <dossier>]`.

## Fichiers principaux

- `app/page.tsx` : tout l'écran (liste, fiche, traitement en 5 parties, création, paramètres). `app/globals.css` (+ `theme-dark.css`).
- `app/api/data/route.ts` : API unique (lecture, actions `update`, `create`, `edit-info`, `list-update`…). `app/api/tracking/route.ts` : suivi colis.
- Règles en `.mjs` testées : `followup.ts` (étapes, imputations), `treatment-steps.mjs`, `carrier-tracking.mjs` (écart d'indemnisation), `advanced-filters.mjs` (`stakeOf`), `analytics-filters.mjs`, `list-settings.mjs`, `edit-info.mjs`, `credit-requests.mjs`, `sla.mjs`, `prefill.mjs`.

## Règles métier à respecter

- 5 statuts : Nouveau → Pris en charge → En attente RC / Résolu → Réouvert. Délais : prise en charge 24 h, réponse transporteur 15 j (réglables, heures calendaires).
- RC et SAV créent ; le dossier appartient à son créateur ; le Service Litige traite en équipe, sans attribution imposée. Paramètres réservés aux Responsables.
- Clôture (« Résolu ») : résultat du litige **et** imputation **Interne / Transporteur / Autre** obligatoires (contrôle serveur). Imputation Interne ou Autre (tiers, ex. point relais) ⇒ pas d'écart d'indemnisation (fiche, suivi, statistiques). Conclusion avéré / non avéré déduite du résultat ; imputation proposée et champs transporteur remplis seuls (`treatment-rules.mjs`).
- Un seul montant : « Montant concerné par le litige » (`disputeValue`), saisi à la création, corrigé par un responsable, repris en partie 3. Ancien dossier sans ce montant ⇒ montant de commande (`stakeOf`).
- Prochaine relance transporteur à J+7, réponse attendue à J+15 après transmission, modifiables.
- Chaque type d'ouverture a son résultat équivalent, sauf Transport et Colis prêt expéditeur (types généraux). Renommer une valeur dans Paramètres peut corriger les anciens dossiers (avec historique).
- Avoirs : la RC, le SAV ou le Service Litige demande ; le Service Litige fait l'avoir dans l'ERP (pas d'API) et note son numéro. Aucune validation par un responsable (confirmé le 16/11/2026) ; un seuil reste réglable dans Paramètres → Demandes d'avoir.
- Toute modification de dossier laisse une ligne d'historique ; le `rev` protège des modifications simultanées.
- Livrer chaque évolution sur une branche `amelioration/…`, commit en français, puis main **après accord**. Mettre à jour le guide (Claude Docs) et `POINT_REPRISE.md`.

## Corrections encore ouvertes (résultat attendu)

| Point | Résultat attendu |
|---|---|
| 368 dossiers résolus à compléter à la main (199 sans résultat ni imputation ; au total 220 sans résultat, 347 sans imputation) | Vue « À vérifier ou compléter » à 0 ; filtre Analyses « Non précisée » à 0 |
| IMP-989 : résultat « Transport », hors liste | Résultat choisi dans la liste des résultats |
| Renommages, validation du pré-remplissage et nettoyage des types faits sur la base **locale** seulement | Même état en production : importer cette base ou refaire les renommages dans Paramètres |
| Un rechargement de page en local repasse en démonstration (ou sous un autre profil) | L'espace réel et le compte restent actifs après rechargement |
| Captures du guide : pièces jointes, webcam (caméra simulée), téléphone non refaites | Captures à jour, prises sur un dossier de test, sans donnée client |
| Suivi colis : clés La Poste (Colissimo, Chronopost) et FedEx à saisir par un responsable (Paramètres → Connexions transporteurs) | Suivi détaillé affiché dans la fiche au lieu du simple lien |
| Envoi d'e-mails (Microsoft 365) non branché ; e-mails « Inversion » en file (`mail-outbox`) | Notifications, abonnements, rapports programmés et alertes Inversion reçus aussi par e-mail |
| Profils de la boîte du Service Litige à déclarer (Équipe & accès → Profils : « Aurélien, Lydia ») | À la connexion avec cette adresse, chacun choisit son profil |
| Mise en ligne : comptes Supabase et Vercel Cybertek, application Entra (IT), domaine ; transfert de la base et des pièces jointes (DEPLOIEMENT-SUPABASE-VERCEL.md) ; copie régulière du compartiment `pieces-jointes` | Outil accessible en ligne, connexion par compte Microsoft, sans serveur local |
| Essai du 23/11/2026 sur un Supabase gratuit (données masquées) : base et envoi direct des photos validés ; connexion Microsoft et Vercel non essayés | Connexion Microsoft et site Vercel vérifiés avec la liste du § 5 du mode d'emploi |
| Power BI : jeton Power BI créé dans Paramètres → Power BI (plus de jeton Cloudflare Access dans cette version) | Tableaux de bord Power BI actualisés chaque jour |
| RGPD : durées à valider par le DPO, purge non codée | Purge automatique planifiée selon les durées validées |
