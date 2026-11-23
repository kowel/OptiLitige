# Reprise des commentaires et pièces jointes de SharePoint

L'export CSV de SharePoint ne contient ni les commentaires (volet de discussion de chaque
élément) ni les pièces jointes. Cette reprise se fait en deux temps :

1. **Export depuis SharePoint**, dans votre navigateur, avec vos droits habituels : un dossier
   sur votre PC avec `reprise.json` (commentaires) et `pj/<ID>/…` (pièces jointes).
2. **Envoi dans OptiLitige** : chaque élément est rattaché au dossier importé qui porte le même
   ID SharePoint (référence `IMP-<ID>`).

Le script d'export est en **lecture seule** : il ne modifie rien dans SharePoint et n'envoie
rien ailleurs que dans le dossier que vous choisissez. **Faites valider son utilisation par
l'informatique** avant de le lancer (il s'exécute sur le site SharePoint de l'entreprise).

## Avant de commencer

- Les dossiers doivent déjà être importés dans OptiLitige **avec la colonne ID** (export de la
  liste avec la colonne « ID » affichée).
- Navigateur : **Microsoft Edge** (ou Chrome), connecté à SharePoint avec un compte qui voit
  toute la liste, ses commentaires et ses pièces jointes.
- Prévoir un dossier vide sur le PC, par exemple
  `C:\Users\<vous>\Desktop\LitigesRC\work\export-sharepoint` (le dossier `work` n'est jamais
  envoyé sur GitHub).

## 1. Exporter depuis SharePoint

1. Ouvrez la liste « Dépot Litiges VPC » dans Edge.
2. Appuyez sur **F12**, puis ouvrez l'onglet **Console**.
3. Ouvrez le fichier `scripts\sharepoint\export-commentaires-pj.js` dans le Bloc-notes,
   **copiez tout son contenu**, collez-le dans la console et appuyez sur **Entrée**.
   - La première fois, Edge peut demander de taper `autoriser le collage` (ou
     `allow pasting`) avant d'accepter un collage : tapez-le, Entrée, puis recollez.
4. Le script retrouve tout seul la liste ouverte (même rangée dans un espace OneDrive
   « /personal/… ») et demande de confirmer son nom et son nombre d'éléments : cliquez sur **OK**.
   S'il ne la trouve pas, il affiche les listes du site : tapez le nom exact de la bonne.
5. Un panneau apparaît en haut à droite : cliquez sur **Choisir le dossier de destination…**,
   choisissez le dossier vide, puis acceptez qu'Edge y écrive.
6. Laissez la page ouverte pendant l'export (compter quelques minutes pour 1 000 éléments ;
   un peu plus s'il y a beaucoup de pièces jointes). Le panneau affiche l'avancement, puis
   « Terminé : … commentaire(s) et … pièce(s) jointe(s) ».

Si SharePoint demande de ralentir (page « Throttle », erreurs 406 dans la console), le script
fait une pause de plus en plus longue puis reprend tout seul : c'est normal.

**Éléments encore en échec ?** Relancez simplement le script (étapes 3 à 5) en choisissant
**le même dossier** : il garde ce qui a déjà été récupéré et ne reprend que les éléments en
échec. Recommencez jusqu'au message « Aucun échec ».

**Relire seulement les commentaires** (par exemple après une correction du script) : relancez-le
dans le même dossier alors que l'export est complet ; il propose de relire uniquement les
commentaires, sans retélécharger les pièces jointes. L'envoi dans OptiLitige met ensuite à jour
les commentaires déjà repris.

## 2. Envoyer dans OptiLitige

Dans un terminal, depuis le dossier du projet :

```bash
pnpm run reprise-sharepoint -- --dossier "work/export-sharepoint" --essai
```

`--essai` vérifie tout sans rien envoyer : nombre de commentaires et de pièces jointes, éléments
SharePoint sans dossier correspondant. Puis, pour de bon :

```bash
pnpm run reprise-sharepoint -- --dossier "work/export-sharepoint"
```

- Par défaut, l'envoi se fait vers la **base locale de test** (`http://127.0.0.1:5173`, avec
  `pnpm dev` lancé).
- Pour le **site en ligne** : ajouter `--site https://<adresse d'OptiLitige>` et
  `--cookie "CF_Authorization=<valeur>"` (cookie de session copié depuis Edge, F12 → Application
  → Cookies, après connexion à OptiLitige avec un compte **Responsables**).
- **Relançable sans risque** : ce qui a déjà été repris est ignoré.

## Ce que l'on retrouve dans OptiLitige

- Les commentaires dans l'onglet **Échanges** du dossier, à leur date d'origine, signés
  « <nom de l'auteur> (SharePoint) » ; les réponses et les mentions sont gardées dans le texte.
- Les pièces jointes dans l'onglet **Pièces jointes**, signées « SharePoint ».
- Une ligne dans l'**Historique** : « … commentaire(s) repris de SharePoint ».

Pour la reprise, les limites habituelles (15 Mo par fichier, 30 par dossier) sont élargies à
95 Mo et 200 pièces jointes. Les formats refusés pour des raisons de sécurité (archives .zip,
pages .htm, fichiers temporaires…) sont listés à la fin de l'envoi : ils restent consultables
dans SharePoint.
