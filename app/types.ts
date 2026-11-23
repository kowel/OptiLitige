// Types des données d'OptiLitige, partagés par l'API et les écrans.
// Ils décrivent ce que l'API enregistre dans la base (champ `payload` de la table records)
// et renvoie au navigateur.

export type Role = 'RC' | 'SAV' | 'Service Litige' | 'Responsable' | 'Admin' | 'Désactivé';
export type Status = 'Nouveau' | 'Pris en charge' | 'En attente RC' | 'Résolu' | 'Réouvert';

/** Rappel personnel d'un agent sur un dossier */
export interface ReminderEntry {
  id: string;
  recordId: string;
  date: string;
  note: string;
  createdAt?: string;
}

/** Dossier suivi par un agent, depuis la date `since` */
export interface WatchEntry {
  id: string;
  since: string;
}

export interface Member {
  email: string;
  name: string;
  role: Role | string;
  // Adresse partagée (app/api/profiles.ts) : profils déclarés, profil choisi, adresse réelle
  profiles?: string[];
  profile?: string;
  account?: string;
  profileOf?: string;
}

export interface HistoryEntry {
  date: string;
  text: string;
  author: string;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  email?: string;
  date: string;
  mentions?: string[];
  /** Identifiant d'origine d'un commentaire repris (ex. « sp-comment-12 » pour SharePoint) */
  sourceKey?: string;
}

export interface TransportMessage {
  id: string;
  kind: string;
  contact: string;
  subject: string;
  body: string;
  date: string;
  author: string;
  recorded: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  date: string;
  author: string;
  email: string;
  /** Pièce jointe reprise (ex. « sp-12/bon.pdf » pour SharePoint) : évite les doublons */
  sourceKey?: string;
}

export interface CreditStep {
  by: string;
  byName: string;
  at: string;
  comment?: string;
  number?: string;
  date?: string;
}

export interface CreditRequest {
  id: string;
  status: 'requested' | 'manager' | 'accepted' | 'issued' | 'refused' | 'cancelled';
  family: 'legal' | 'commercial' | 'fees';
  reason: string;
  kind: 'total' | 'partial' | 'shipping';
  imputation: string;
  amount: number;
  approvedAmount?: number;
  comment: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  statusAt: string;
  review?: CreditStep;
  decision?: CreditStep;
  issue?: CreditStep;
  cancel?: CreditStep;
}

export interface Dossier {
  id: string;
  ref: string;
  version: number;
  /** Révision du contenu : augmente à chaque modification du dossier, sauf les ajouts
   *  (commentaires, messages transporteur, suivi client, pièces jointes). Sert à détecter qu'un
   *  collègue a vraiment modifié le traitement ; un simple commentaire ne bloque pas un enregistrement. */
  rev?: number;
  /** Champs pré-remplis d'après les échanges, à vérifier par le Service Litige */
  prefilled?: { at: string; by: string; fields: string[]; sources: Record<string, string> };
  /** Présent sur les dossiers de la liste allégée (sans historique ni données source) */
  lite?: boolean;
  title: string;
  status: Status | string;
  origin: 'Transport' | 'Interne' | string;
  created: string;
  statusSince?: string;
  closed: string | null;
  reopened: string[];
  creator: string;
  assignee: string;
  assignedAt?: string;
  priority?: string;
  // Client et commande
  customer: string;
  customerAccount?: string; // numéro de compte client (obligatoire à la création)
  order: string;
  amount: number;
  brand?: string;
  productType?: string;
  productRef?: string;
  /** Magasin concerné, quand l'enseigne est « MAGASIN » */
  store?: string;
  requester?: string;
  // Adresse du compte Microsoft du demandeur (choisi dans l'annuaire de l'équipe)
  requesterEmail?: string;
  ticket?: string;
  bt?: string;
  invoice?: string;
  type: string;
  description?: string;
  /** Liste allégée : début de la description saisie à la création (récapitulatif) */
  descriptionShort?: string;
  // Transporteur
  carrier?: string;
  carrierStatus?: string;
  carrierCaseRef?: string;
  carrierSentAt?: string | null;
  carrierResponseDue?: string | null;
  carrierFollowupAt?: string | null;
  carrierReplyAt?: string | null;
  /** Fin du dossier transporteur (statut « Clos ») et solution client définitive (app/delays.mjs) */
  carrierClosedAt?: string | null;
  clientSolvedAt?: string | null;
  clientStage?: string;
  // Suivi financier et résultat
  outcome?: string;
  imputation?: string; // Interne | Transporteur | Autre (choisi à la clôture)
  creditIssued?: boolean;
  creditNumber?: string;
  credit?: number;
  creditCreated?: string | null;
  compensation?: number;
  compensationState?: string;
  /** Décision du transporteur sur la réclamation : Accepté, Partiel ou Refusé */
  carrierDecision?: string;
  disputeValue?: number;
  indemTps?: number;
  takenAt?: string | null;
  rcCheck?: string;
  rcManager?: string;
  followUp?: string;
  solution?: string;
  solco?: string;
  resolution?: { verdict: string; reason: string } | null;
  // Contenus
  comments: Comment[];
  history?: HistoryEntry[];
  transportMessages?: TransportMessage[];
  attachments?: Attachment[];
  credits?: CreditRequest[];
  // Import depuis Microsoft Lists
  importedAt?: string;
  importFile?: string;
  sourceList?: string;
  sourceId?: string;
  sourceData?: Record<string, unknown>;
}

/** Listes de l'espace Contentieux réglées dans Paramètres → Contentieux */
export interface ContentieuxSettings {
  kinds: { id: string; risk: number; days: number }[];
  subjects: { name: string; subs: string[] }[];
  decisions: string[];
}

/** Contentieux d'un client (espace Contentieux, responsables ; app/contentieux.mjs) */
export interface Contentieux {
  id: string;
  ref: string;
  version: number;
  receivedAt: string;
  kind: string;
  status: string;
  brand: string;
  customerAccount: string;
  order: string;
  productRef: string;
  amount: number | null;
  subject: string;
  subSubject: string;
  decision: string;
  refund: number | null;
  surcharge: number | null;
  fees: number | null;
  returnedProductRef: string;
  priceGap: number | null;
  /** Message du client (collé tel quel) et réponse qu'on lui a apportée */
  customerMessage?: string;
  customerReply?: string;
  comment: string;
  /** Pièces jointes (fichiers dans R2 sous contentieux/<id>/…, app/api/attachments) */
  attachments?: Attachment[];
  /** Dossier litige relié (même commande, liaison acceptée par un responsable) */
  dossierId?: string;
  dossierRef?: string;
  /** Délai légal (jours) et niveau de risque retenus à l'enregistrement */
  legalDays?: number | null;
  risk?: number | null;
  /** Dossiers proposés en liaison et refusés : plus proposés */
  declined?: string[];
  createdAt: string;
  createdBy: string;
  history: HistoryEntry[];
}

/** Ligne de la table records telle que lue dans D1 */
export interface RecordRow {
  id?: string;
  payload: string;
  version: number;
}

/** Ligne de la table settings */
export interface SettingRow {
  payload: string;
}

/** Résultat d'une action sur une demande d'avoir (app/credit-requests.mjs, applyCreditAction) */
export interface CreditActionResult {
  error?: string;
  status?: number;
  message?: string;
}

/** Notification « à traiter » d'une catégorie (app/alerts.mjs, buildAlerts) */
export interface AlertItem {
  key: string;
  record: Dossier;
  /** Notification « Rapports » : rapport programmé et période */
  reportId?: string;
  period?: { key: string; kind: string; from: string; to: string; label: string };
  date: string;
  title: string;
  text: string;
  unread: boolean;
}

/** Réglages des demandes d'avoir (Paramètres → Avoirs, app/credit-requests.mjs) */
export interface CreditSettingsData {
  reasons: Record<string, string[]>;
  imputations: string[];
  /** Montant au-delà duquel un responsable valide (null ou vide = jamais) */
  managerAbove: Record<string, number | string | null>;
  /** Destinataire du mail « Nouvelle demande d'avoir » (Pierre Mazeaud par défaut) */
  notify?: { name: string; email: string };
}

/** Règle de délai (SLA) réglée dans Paramètres → Délais (app/sla.mjs) */
export interface SlaRule {
  id: string;
  label: string;
  kind: string;
  status?: string;
  hours: number;
  enabled?: boolean;
}

/** Filtres avancés de la liste des dossiers (app/advanced-filters.mjs, EMPTY_ADVANCED) */
export interface AdvancedFilters {
  brand: string;
  carrier: string;
  type: string;
  productType: string;
  /** Service du créateur : RC, SAV, import */
  source: string;
  min: string;
  max: string;
  /** with = au moins un avoir, without = aucun */
  credit: string;
}

/** Filtres complets de la liste, tels qu'enregistrés dans une vue */
export interface ListFilters {
  q: string;
  status: string;
  origin: string;
  scope: string;
  period: string;
  adv: AdvancedFilters;
}

/** Vue enregistrée, partagée par les comptes d'un même service */
export interface SavedView {
  id: string;
  name: string;
  filters: ListFilters;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
}

/** Dossier lu dans un fichier Excel, prêt à être importé (app/import-logic.mjs, transform) */
export type ImportItem = Partial<Dossier> & {
  externalId?: string;
  historicalNotes?: string;
  importedClosed?: string | null;
};

/** Ligne du journal des accès (ajout, changement de service, désactivation d'un agent) */
export interface AccessLogEntry {
  date: string;
  by: string;
  byName?: string;
  email: string;
  before: { name: string; role: string } | null;
  after: { name: string; role: string } | null;
  note?: string;
}

/** Listes de valeurs proposées dans les formulaires (Paramètres → Listes) */
export type Catalogs = {
  brands: string[];
  products: string[];
  outcomes: string[];
  carriers: string[];
  /** Magasins proposés quand l'enseigne est « MAGASIN » */
  stores?: string[];
  /** États du dossier transporteur et étapes côté client (modifiables dans Paramètres) */
  carrierStages?: string[];
  clientStages?: string[];
};

/**
 * Données de l'écran principal : renvoyées par GET /api/data en espace réel, ou conservées
 * dans le navigateur en démonstration.
 */
export interface AppData {
  records: Dossier[];
  members: Member[];
  types: string[];
  catalogs: Catalogs;
  me: Member;
  sla?: SlaRule[];
  creditSettings?: CreditSettingsData;
  /** Expéditions par mois et par transporteur : { '2026-11': { COLISSIMO: 1234 } } */
  shipments?: Record<string, Record<string, number>>;
  /** Seuils des contours orangé et rouge de la liste (montant de commande, 0 = désactivé) */
  amountAlerts?: { orange: number; red: number };
  /** Alerte client récidiviste : nombre de litiges sur une période, fraude */
  repeatAlerts?: { count: number; months: number; fraud: boolean };
  /** Rapports programmés par les responsables */
  reports?: {
    id: string;
    name: string;
    frequency: 'monthly' | 'weekly';
    filters: Record<string, string>;
    recipients: { emails: string[]; roles: string[] };
    active: boolean;
  }[];
  /** Signatures des e-mails (onglet Transporteur) */
  mailSignatures?: MailSignature[];
  /** Corbeille des pièces jointes (admins) : vidage automatique, désactivé par défaut */
  trashSettings?: { autoPurge: boolean; days: number };
  /** Modèles de réclamation transporteur */
  claimTemplates?: {
    id: string;
    title: string;
    keywords: string[];
    subject: string;
    body: string;
  }[];
  trackingLinks?: Record<string, string>;
  /** Connexions aux API des transporteurs (responsables) : état, jamais les clés */
  carrierApis?: Record<string, CarrierApiStatus>;
  /** Connexion Power BI (responsables) : état du jeton, jamais le jeton */
  powerbi?: PowerBiStatus;
  /** Délais des relances transporteur (jours) */
  carrierDelays?: { followupDays: number; responseDays: number };
  /** Dossiers suivis par l'agent (bouton « Suivre ce dossier ») */
  watching?: WatchEntry[];
  /** Démonstration : dossiers suivis par compte */
  watchingByUser?: Record<string, WatchEntry[]>;
  /** Rappels personnels de l'agent (« Me rappeler le… ») */
  reminders?: ReminderEntry[];
  /** Démonstration : rappels par compte */
  remindersByUser?: Record<string, ReminderEntry[]>;
  /** Adresse de déconnexion (déconnexion automatique après inactivité) */
  signOut?: string;
  /** Préférences d'affichage du compte : format des graphiques, ordre par écran */
  prefs?: { charts: Record<string, string>; layouts: Record<string, string[]> };
  /** Couleur de chaque enseigne (Paramètres → Enseignes) */
  brandColors?: Record<string, string>;
  /** Origine et date de la dernière mise à jour des expéditions */
  shipmentsInfo?: { source: string; at: string; by?: string } | null;
  /** Vues enregistrées du service de l'agent */
  savedViews?: SavedView[];
  // Adresses de connexion (sans le détail des profils) et profils déclarés par adresse
  accounts?: Member[];
  memberProfiles?: Record<string, string[]>;
  readNotificationIds?: string[];
  readAlertKeys?: string[];
  /** Réservé aux responsables */
  accessLog?: AccessLogEntry[];
  /** Espace Contentieux : réservé aux admins */
  contentieux?: Contentieux[];
  contentieuxSettings?: ContentieuxSettings;
  mailbox?: string;
  signIn?: string;
  // Démonstration uniquement : lectures et vues rangées par agent ou par service
  notificationReadsByUser?: Record<string, string[]>;
  alertReadsByUser?: Record<string, string[]>;
  roleViews?: Record<string, SavedView[]>;
}

// État d’une connexion API transporteur (Paramètres → Connexions transporteurs)
export interface CarrierApiStatus {
  label: string;
  configured: boolean;
  /** 'outil' : clé saisie par un responsable ; 'serveur' : secret réglé par l'informatique */
  source: '' | 'outil' | 'serveur';
  hint: string;
  savedAt: string;
  savedBy: string;
}

// État de la connexion Power BI (Paramètres → Power BI)
export interface PowerBiStatus {
  active: boolean;
  createdAt: string;
  createdBy: string;
  hint: string;
  lastUsedAt: string;
}

/** Signature d'e-mail (Paramètres → Signatures d'e-mail) */
export interface MailSignature {
  id: string;
  name: string;
  /** Enseignes pour lesquelles elle est proposée d’office */
  brands: string[];
  text: string;
  /** Logo en image encodée (data:image/…;base64), vide sans logo */
  logo: string;
  logoWidth: number;
}
