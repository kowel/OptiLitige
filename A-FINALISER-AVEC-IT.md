# OptiLitige — à finaliser avec l'informatique

> **Version de référence, à partager et modifier à plusieurs :** [document Claude « OptiLitige — à finaliser avec l'informatique »](https://claude.ai/artifact/9UbcPLRJj4QcJP8WxA5Lvj) (créé le 12/11/2026). Ce fichier en garde une copie technique ; en cas d'écart, le document fait foi.

> **Version Supabase + Vercel.** Le document Claude ci-dessus a été écrit pour la version Cloudflare. Dans ce dépôt, ce qui concerne Cloudflare (Access, D1, R2, Wrangler) est remplacé par Supabase et Vercel ; la mise en ligne est décrite dans [DEPLOIEMENT-SUPABASE-VERCEL.md](DEPLOIEMENT-SUPABASE-VERCEL.md).

Points qui demandent des accès que l'équipe projet n'a pas (Supabase, Vercel, Microsoft 365 / Entra).

## 1. Mise en ligne (bloquant)

| À fournir                                                                  | Par qui                      | Pour quoi                                        |
| -------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------ |
| Compte Supabase Cybertek, offre Pro (projet en Europe)                     | IT                           | Base de données, pièces jointes, connexion       |
| Compte Vercel Cybertek, offre Pro, relié au dépôt GitHub `optilitige`      | IT                           | Héberger le site                                 |
| Application Entra ID (« OptiLitige »), adresse de retour Supabase          | Administrateur Entra         | Connexion avec les comptes Microsoft             |
| Nom de domaine (ex. `litiges.cybertek.fr`) pointé vers Vercel              | IT / gestionnaire du domaine | Adresse du site                                  |
| Accord de traitement des données (DPA) de Supabase et de Vercel            | IT / DPO                     | RGPD                                             |
| Adresse Microsoft du propriétaire de l'outil (chef de projet)              | Chef de projet               | Premier admin (`OWNER_EMAIL`)                    |

Pas à pas : [DEPLOIEMENT-SUPABASE-VERCEL.md](DEPLOIEMENT-SUPABASE-VERCEL.md) (§ 1 Supabase, § 2 Entra, § 3 Vercel,
§ 4 transfert des données, § 5 vérifications). **Le propriétaire (admin) est l'adresse Microsoft
indiquée dans `OWNER_EMAIL`** : ce doit être le chef de projet. Le premier venu ne peut pas le devenir.

### Sécurité des comptes (demande du 10/11/2026)

OptiLitige ne gère **aucun mot de passe** : chaque agent se connecte avec son compte Microsoft
Cybertek (Entra ID, via Supabase Auth). La règle demandée s'applique donc aux comptes
Microsoft, côté IT :

- **Mot de passe robuste, au minimum** : 12 caractères, au moins une majuscule, un chiffre et un
  caractère spécial.
  - Comptes synchronisés depuis un Active Directory local : stratégie de mot de passe AD
    (longueur minimale 12 et complexité), éventuellement une stratégie affinée pour les agents
    d'OptiLitige.
  - Comptes uniquement dans le cloud (Entra) : la longueur minimale est fixée par Microsoft ;
    pour garantir 12 caractères, passer par la protection par mot de passe Entra.
- **Authentification multifacteur (MFA) : non retenue** pour OptiLitige (décision du 10/11/2026).
  Si les comptes Microsoft 365 l'ont déjà, elle s'applique d'elle-même à la connexion.
- **Déconnexion automatique après 2 heures sans action : faite dans OptiLitige** (préavis
  d'une minute, bouton « Rester connecté », onglets synchronisés ; `app/idle-logout.tsx`). Côté
  Supabase (offre Pro), fixer en plus une durée maximale de session (Authentication → Sessions,
  par exemple 8 h) ; la déconnexion passe par `/auth/deconnexion`.

## 2. Reprise de l'historique

**Mise à jour du 10/11/2026 :** l'historique SharePoint (1 025 litiges, commentaires, pièces
jointes) est déjà repris dans la base de test du poste projet, et les responsables y corrigent les
erreurs de saisie (montants, n° de commande). Le jour de la mise en ligne, on **transfère cette
base** (DEPLOIEMENT-SUPABASE-VERCEL.md § 4, `scripts/transfert-vers-supabase.mjs`) au lieu de
réimporter SharePoint. Prévoir environ 5 Go dans Supabase Storage pour les pièces jointes (100 Go
compris dans l'offre Pro).

Ancienne procédure (avant reprise locale) :

Fournir l'export Microsoft Lists / SharePoint (~1 050 litiges 2026 + ceux du SAV) au moment de
la bascule. Import par l'écran « Importer Excel » (responsables), testable avant en local.

### Commentaires et pièces jointes de SharePoint (demande du 10/11/2026)

**Fait** : commentaires et pièces jointes récupérés avec le script en lecture seule
`scripts/sharepoint/export-commentaires-pj.js` (lancé depuis le navigateur d'un responsable qui a
accès à la liste) et rattachés aux dossiers. Aucun accès supplémentaire à demander à l'IT.

## 3. Relances par e-mail ou Teams — à préparer avec l'IT

Événements prévus : mention d'un agent, nouveau dossier pour le Service Litige, dossier non pris
en charge dans le délai, relance transporteur à faire / réponse transporteur en retard, et
**nouveauté sur un dossier suivi** (abonnement, demande du 12/11/2026 : aujourd'hui visible
seulement dans la cloche d'OptiLitige, onglet « Abonnements »). **Décision du 12/11/2026 : les
abonnements sont notifiés uniquement par e-mail (à l'agent abonné) et dans l'outil, pas par
Teams.** Il faut donc l'option e-mail ci-dessous, au moins pour eux.

**Litiges « Inversion » (13/11/2026)** : à l'ouverture d'un litige de type Inversion, un e-mail
part à toute l'équipe (Service Litige, responsables, agents RC et SAV) et une notification
« Prioritaires » apparaît dans la cloche de chacun. La notification fonctionne déjà ; l'e-mail est
**préparé dans une file d'envoi** (`mail-outbox` dans la base) et partira dès que l'envoi
d'e-mails ci-dessous sera branché.

**Adresse partagée du Service Litige (13/11/2026)** : la boîte du Service Litige est utilisée par
Aurélien et Lydia. Dans Équipe & accès, bouton « Profils » sur cette adresse : « Aurélien, Lydia ».
À la connexion, chacun choisit son profil (retenu sur le poste) ; actions, mentions et notifications
sont à son nom. Rien à faire côté Entra : une seule adresse de connexion.

**Rapports programmés (12/11/2026)** : créés par les responsables dans Paramètres (filtres, mensuel ou
hebdomadaire, personnes ou services destinataires), livrés aujourd'hui dans l'outil (cloche →
« Rapports », impression PDF). À prévoir avec l'option e-mail : envoi automatique du PDF en début de
période (tâche planifiée Vercel Cron, même boîte d'envoi). Rappels personnels : e-mail le matin du
rappel possible avec la même option.

Deux options, à choisir avec l'IT :

- **Teams (le plus simple)** : un canal « Litiges » avec un webhook _Workflows_ (Power Automate).
  Pas d'application Entra à créer ; il suffit de l'adresse du webhook.
- **E-mail** : une application Entra avec la permission Microsoft Graph `Mail.Send` (application),
  **limitée à une boîte d'envoi dédiée** (ex. `optilitige@cybertek.fr`) par une
  _Application Access Policy_ Exchange. À fournir : identifiant d'application, annuaire (tenant),
  secret ou certificat, adresse de la boîte d'envoi.

### Échanges avec les transporteurs depuis OptiLitige (décision du 06/11/2026)

Les agents enverront et recevront leurs e-mails transporteurs **directement depuis l'outil**, avec
leur propre adresse Cybertek (pas de bouton « ouvrir dans Outlook »). À demander à l'IT :
une application Entra avec les permissions Microsoft Graph **déléguées** `Mail.Send` et
`Mail.Read` (chaque agent autorise une fois son compte), pour envoyer depuis la boîte de l'agent
et rattacher les réponses au dossier.

Les vérifications de délais tourneront automatiquement (tâche planifiée Vercel Cron) :
à activer au déploiement.

### Demandeur relié à l'annuaire Outlook (demande du 09/11/2026)

Aujourd'hui, le champ **Demandeur** (obligatoire, l'agent connecté par défaut) propose les comptes
Microsoft de l'équipe déclarés dans « Équipe & accès ». Pour chercher n'importe quelle personne de
Cybertek dans l'annuaire Outlook, ajouter à la même application Entra la permission Microsoft Graph
déléguée `People.Read` (ou `User.ReadBasic.All`).

### Plateforme des transporteurs (demande du 09/11/2026, à finaliser plus tard)

Un emplacement est prévu dans l'onglet **Transporteur** de chaque dossier (« Plateforme
COLISSIMO », « Plateforme CHRONOPOST »…) pour que le service litige fasse ses demandes au service
client du transporteur choisi sans quitter l'outil. Il affiche pour l'instant « Bientôt
disponible ». À réunir avant de le finaliser :

- pour chaque transporteur : adresse de la plateforme de réclamation, compte professionnel
  Cybertek, et s'il existe une API ou un formulaire en ligne ;
- des captures des plateformes, pour adapter l'écran à ce qu'elles demandent (champs, pièces
  jointes, suivi) ;
- avec l'IT : où conserver les identifiants des comptes transporteurs en sécurité.

### Suivi des colis dans chaque dossier (demandes du 12/11/2026)

En haut de chaque fiche, le panneau **Suivi du colis** affiche la frise des étapes et
l'historique détaillé du colis (numéro du champ BT), lus sur l'**API officielle** du transporteur
(`/api/tracking`, `app/tracking-providers.mjs`). Le résultat est gardé 30 minutes (7 jours une
fois livré) ; bouton « Actualiser ». Tant qu'une clé manque, le panneau l'indique et propose la
page du transporteur. **Depuis le 16/11/2026, les responsables saisissent et testent eux-mêmes
les clés** dans Paramètres → Connexions transporteurs (gardées dans la base, jamais réaffichées,
prioritaires sur d'éventuels secrets du serveur). Ces connexions servent au suivi des colis ; les
échanges avec le service client des transporteurs passent par l'e-mail Microsoft 365.

À faire pour l'activer :

1. **La Poste « Suivi v2 »** (Colissimo **et** Chronopost, ≈ 2/3 des dossiers) : créer un compte
   gratuit sur developer.laposte.fr avec une adresse Cybertek, souscrire à l'API **Suivi**, copier
   la clé (« X-Okapi-Key ») et la saisir dans Paramètres → Connexions transporteurs (ou, côté
   serveur, variable `LAPOSTE_OKAPI_KEY` dans Vercel).
2. **FedEx Track API** (FedEx) : compte sur developer.fedex.com, projet « Track API », puis
   saisir les identifiants dans Paramètres → Connexions transporteurs (ou variables
   `FEDEX_CLIENT_ID` et `FEDEX_CLIENT_SECRET` dans Vercel).
3. **TNT France, GEODIS, FRANCE EXPRESS, KUEHNE NAGEL** : pas d'API branchée. Demander à chacun
   s'il propose une API de suivi pour ses clients professionnels (TNT dépend de FedEx : vérifier si
   la Track API FedEx accepte les numéros TNT France). En attendant, la fiche propose leur page de
   suivi ; adresses de GEODIS, FRANCE EXPRESS et KUEHNE NAGEL à saisir dans **Paramètres → Liens de
   suivi des colis**.

Note : la lecture automatique des pages web des transporteurs a été écartée (protections
anti-robots, conditions d'utilisation, pages qui changent sans prévenir).

### Nombre d'expéditions depuis l'outil d'expédition (demande du 10/11/2026)

Pour le **ratio litiges / expéditions** du tableau de bord transporteurs, OptiLitige doit
recevoir le nombre d'expéditions par mois et par transporteur depuis l'outil qui les connaît
(ERP, logiciel d'expédition, export transporteur…). La porte d'entrée est prête :

- adresse `POST https://<adresse d'OptiLitige>/api/shipments`, protégée par un jeton
  (`Authorization: Bearer <jeton>`) ;
- contenu : `{ "source": "ERP", "entries": [ { "month": "2026-11", "carrier": "COLISSIMO", "count": 1234 } ] }`
  (un envoi par jour ou par mois ; un mois renvoyé remplace ses valeurs) ;
- en attendant, les responsables saisissent ou corrigent les nombres dans **Paramètres →
  Expéditions par transporteur**.

À décider avec l'IT :

- **quel outil** fournit les expéditions, et s'il peut appeler une adresse web (tâche planifiée,
  Power Automate, script). Sinon : un export CSV déposé sur SharePoint, que l'on lirait avec
  Microsoft Graph ;
- les **noms de transporteurs** utilisés par cet outil (« Colissimo-ML », « Colissimo-RC »…),
  pour les faire correspondre à ceux d'OptiLitige ;
- le **jeton** (variable `SHIPMENTS_TOKEN` dans Vercel), seule protection de ce chemin dans
  cette version : il doit être long et aléatoire.

### Power BI : lecture des données des litiges (16/11/2026)

Power BI peut lire les données d'OptiLitige : une ligne par litige (volet transport compris) et une
ligne par mois et par transporteur pour les expéditions (`/api/powerbi`, lecture seule, sans nom
ni compte client). **Les responsables créent eux-mêmes le jeton** dans Paramètres → Power BI.

Dans cette version, le jeton Power BI suffit (il n'y a plus de jeton de service Cloudflare Access).
OptiLitige n'apporte que la partie litiges : pour tout le flux transport, Power BI devra aussi lire
l'outil d'expédition ou l'ERP.

## 4. Sauvegardes

- La base est sauvegardée chaque jour par Supabase (offre Pro, 7 jours gardés ; restauration à la
  minute près en option). **Les fichiers des pièces jointes ne le sont pas** : une pièce jointe
  supprimée est rangée dans une corbeille du stockage (`corbeille/`), récupérable. Rien n'est effacé
  automatiquement, sauf si un admin l'active (Paramètres → Corbeille des pièces jointes). **À faire
  par l'IT** : copier régulièrement le compartiment
  `pieces-jointes` (DEPLOIEMENT-SUPABASE-VERCEL.md § 6).
- À décider avec l'IT : fréquence (hebdomadaire conseillée), poste ou serveur qui l'exécute
  (tâche planifiée Windows), et emplacement de stockage sûr (SharePoint, serveur de fichiers),
  avec une durée de conservation des sauvegardes cohérente avec le § 7.

## 5. Guide de prise en main

Le bouton « Guide de prise en main » de l'outil ouvre le guide complet (lien dans
`app/guide-link.ts`). Le guide est un document claude.ai : **le partager avec l'organisation**
(bouton « Partager ») pour que tous les agents puissent l'ouvrir, ou le déplacer sur SharePoint /
l'intranet et mettre à jour le lien.

## 6. Journal des accès

Déjà en place : chaque ajout, changement de service ou désactivation d'un agent est enregistré
(qui, quoi, quand) et visible des responsables dans « Équipe & accès ». À vérifier après la mise
en ligne.

## 7. RGPD — durées de conservation (à valider avec le DPO ou un juriste)

Cadre général en France (repères, pas un avis juridique) :

- Le RGPD n'impose pas de durée fixe : les données doivent être gardées **le temps nécessaire**
  au but poursuivi, puis supprimées ou anonymisées.
- La CNIL (référentiel « gestion commerciale clients ») admet de garder les données pendant la
  relation commerciale, puis en **archive à accès restreint** le temps des délais de recours.
- Délais de recours utiles : **5 ans** pour une action en justice entre un client et un
  commerçant (prescription de droit commun) ; **2 ans** pour la garantie légale de conformité.
- Les **factures et avoirs** se gardent **10 ans**, mais ils sont dans l'ERP, pas dans OptiLitige.

Proposition à valider :

| Donnée                                | Durée proposée          | Ensuite                                                                         |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| Dossier ouvert                        | Tant qu'il est en cours | —                                                                               |
| Dossier clôturé, avec nom du client   | 3 ans après la clôture  | Nom du client effacé ; n° de commande, ticket, montants et historique conservés |
| Pièces jointes (photos, BL, e-mails…) | 5 ans après la clôture  | Supprimées automatiquement                                                      |
| Journal des accès                     | 1 an                    | Supprimé                                                                        |

Autres mesures conseillées : rendre le **nom du client facultatif** (le n° de commande et de
ticket suffisent à retrouver le client dans l'ERP) ; rappeler aux agents de ne pas photographier
plus que nécessaire (étiquettes avec adresse) ; inscrire OptiLitige au **registre des
traitements** de Cybertek. Une fois les durées validées, la suppression automatique sera ajoutée
(tâche planifiée Vercel Cron ou Supabase).
