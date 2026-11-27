'use client';
import { useState, useEffect, useRef, useDeferredValue } from 'react';
import type { ReactNode } from 'react';
import Importer from './importer';
import CommentComposer from './comment-composer';
import { kpiCards, kpiRows, kpiScopes } from './kpi-data.mjs';
import DashboardVisuals, { AnalyticsDashboard } from './dashboard-visuals';
import { creditIssuedStamp, creditToday, resolveCredit } from './credit.mjs';
import { notificationKey } from './notifications.mjs';
import TransportConversation from './transport-conversation';
import Attachments from './attachments';
import NewAttachments from './new-attachments';
import { sendAttachment } from './attachment-upload';
import CarrierPlatform from './carrier-platform';
import OutcomeStats from './outcome-stats';
import { GUIDE_URL } from './guide-link';
import { applyTreatmentRules, verdictOf } from './treatment-rules.mjs';
import {
  CARRIER_DECISIONS,
  NOT_CARRIER,
  indemnityGap,
  isAnticipatedCredit,
  trackingCsv,
} from './carrier-tracking.mjs';
import TrackingTable from './tracking-table';
import ShipmentSettings from './shipment-settings';
import AmountAlertSettings from './amount-alert-settings';
import ParcelTimeline from './parcel-timeline';
import TrackingLinkSettings from './tracking-link-settings';
import CarrierApiSettings from './carrier-api-settings';
import ClaimFormSettings from './claim-form-settings';
import { normalizeClaimForms } from './claim-forms.mjs';
import { invitationMail } from './invitation.mjs';
import { DEFAULT_TRACKING_LINKS, normalizeTrackingLinks } from './parcel-tracking.mjs';
import EditInfoForm from './edit-info-form';
import BrandName, { brandKey } from './brand-name';
import ListEditor from './list-editor';
import { ChartPrefsContext } from './chart-formats';
import IdleLogout from './idle-logout';
import {
  DEFAULT_BRAND_COLORS,
  DEFAULT_STAGES,
  LIST_DEFS,
  LOCKED,
  darkVariant,
  normalizeListUpdate,
  renameText,
} from './list-settings.mjs';
import { applyInfoEdit, changesText } from './edit-info.mjs';
import { dateTime, importInfo } from './datetime.mjs';
import { matchesSearch, sameOrderRecords } from './search.mjs';
import { demoAccessEntry, describeAccessChange } from './access-log.mjs';
import { DEFAULT_SLA, formatHours, lateRules } from './sla.mjs';
import SlaSettings from './sla-settings';
import { ALERT_CATEGORIES } from './alerts.mjs';
import { toggleWatch } from './watch.mjs';
import { useWorkload } from './use-workload';
import { sameComments, shareComments, useLiveComments } from './live-comments';
import { addReminder, removeReminder } from './reminders.mjs';
import ReminderBox from './reminder-box';
import RepeatCustomerBanner from './repeat-customer-banner';
import RepeatAlertSettings from './repeat-alert-settings';
import BulkBar from './bulk-bar';
import MyDay from './my-day';
import ReportView from './report-view';
import ReportPeriod from './report-period';
import TreatmentGuide, { GUIDE_HELP, SectionHint } from './treatment-guide';
import HelpTip, { setHelpOpen, useHelpOpen } from './help-tip';
import CarrierDelaySettings from './carrier-delay-settings';
import PrefillBanner from './prefill-banner';
import {
  DEFAULT_CARRIER_DELAYS,
  autoCarrierDates,
  nextFollowup,
  normalizeCarrierDelays,
} from './carrier-delays.mjs';
import { parisToday } from './reminders.mjs';
import type { ReportData } from './report-view';
import ReportSettings from './report-settings';
import type { ScheduledReport } from './report-settings';
import {
  buildReport,
  lastClosedPeriod,
  monthPeriod,
  normalizeReports,
  rangeError,
  rangePeriod,
  weekPeriod,
} from './reports.mjs';
import { csvCell } from './csv.mjs';
import type { DaySection } from './my-day';
import { applyBulk } from './bulk-actions.mjs';
import { DEFAULT_CLAIM_TEMPLATES, normalizeTemplates } from './claim-templates.mjs';
import { DEFAULT_SIGNATURES, normalizeSignatures } from './mail-signatures.mjs';
import SignatureSettings from './signature-settings';
import TrashSettingsPanel from './trash-settings-panel';
import { DEFAULT_TRASH_SETTINGS } from './trash-settings.mjs';
import { DEFAULT_REPEAT_ALERTS, normalizeRepeatAlerts, repeatInfo } from './repeat-customer.mjs';
import AlertList from './alert-list';
import PrintSheet from './print-sheet';
import ThemeToggle from './theme-toggle';
import ThemeFavicon from './theme-favicon';
import StatsTable from './stats-table';
import CarrierCostPanel from './carrier-cost-panel';
import PeriodPicker from './period-picker';
import { inPeriod, periodLabel } from './period.mjs';
import { participants } from './participants.mjs';
import ListTools from './list-tools';
import {
  EMPTY_ADVANCED,
  applyViewAction,
  amountMark,
  stakeOf,
  DEFAULT_AMOUNT_ALERTS,
  normalizeAmountAlerts,
  matchesAdvanced,
} from './advanced-filters.mjs';
import CreditPanel from './credit-panel';
import CreditQueue from './credit-queue';
import CreditSettings from './credit-settings';
import {
  CREDIT_KINDS,
  CREDIT_STATUSES,
  DEFAULT_CREDIT_SETTINGS,
  applyCreditAction,
  openCredits,
} from './credit-requests.mjs';
import {
  brands,
  products,
  outcomes,
  disputeTypes,
  carriers,
  stores,
  STORE_BRAND,
} from './catalogs';
import {
  waitingCarrier,
  overdueCarrier,
  imputations,
  noCarrierClaim,
  followUpText,
} from './followup';
import type {
  AdvancedFilters,
  AppData,
  Catalogs,
  Contentieux,
  CreditActionResult,
  CreditSettingsData,
  Dossier,
  ImportItem,
  ListFilters,
  Member,
  SavedView,
  SlaRule,
} from './types';
import {
  LayoutDashboard,
  FolderOpen,
  ChartNoAxesCombined,
  Users,
  Settings,
  Plus,
  Search,
  Bell,
  CircleHelp,
  Sun,
  Receipt,
  BellRing,
  ChevronRight,
  CheckCircle2,
  ArrowUpRight,
  BookOpen,
  ArrowDownToLine,
  ArrowLeft,
  Sparkles,
  Truck,
  Monitor,
  Clock,
  Check,
  CheckCheck,
  X,
  Pencil,
  RefreshCw,
  Send,
  Link2,
  ShieldCheck,
  LifeBuoy,
  Wrench,
  Timer,
  Printer,
  Trash2,
  Mail,
  Scale,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TransportDraft } from './transport-conversation';
import AnalyticsFilterBar from './analytics-filter-bar';
import type { AnalyticsFilters } from './analytics-filter-bar';
import {
  EMPTY_ANALYTICS,
  countAnalytics,
  describeAnalytics,
  filterAnalytics,
  matchesAnalytics,
} from './analytics-filters.mjs';
import { inPeriod as inPeriodOf } from './period.mjs';
import ContentieuxView from './contentieux-view';
import ContentieuxSettingsPanel from './contentieux-settings';
import ContentieuxDashboard from './contentieux-dashboard';
import type { ContentieuxFocus } from './contentieux-view';
import { createsDisputes, isAdmin, seesAnalytics, treatsDisputes } from './roles.mjs';
import MyData from './my-data';
import DossierRecap from './dossier-recap';

// Pages permises à chaque rôle (menu de gauche et changement de rôle en démonstration)
function pageAllowed(page: string, role: string) {
  if (['settings', 'team', 'contentieux', 'contentieux-analytics'].includes(page))
    return isAdmin(role);
  if (page === 'analytics') return seesAnalytics(role);
  if (page === 'my-data') return createsDisputes(role);
  if (page === 'credits') return treatsDisputes(role);
  return true;
}
import {
  DEFAULT_CONTENTIEUX_SETTINGS,
  applyContentieuxAction,
  applyContentieuxRenames,
  contentieuxSummary,
  normalizeContentieuxSettings,
  daysLeft as contentieuxDaysLeft,
  matchingDossiers,
} from './contentieux.mjs';

// Mode démonstration (données fictives enregistrées dans le navigateur) : désactivé par défaut,
// le site ouvre directement l'espace réel et renvoie vers la connexion Microsoft si besoin.
// NEXT_PUBLIC_DEMO=1 (variable lue à la construction du site) le réactive.
const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO === '1';
// Garde-fou : pas de renvoi automatique vers la connexion plus d'une fois par minute (évite une
// boucle si la session n'est pas reconnue au retour de Microsoft)
const SIGN_IN_REDIRECT_KEY = 'optilitige-signin-redirect';

// Formulaire de création d'un dossier (montant vide tant qu'il n'est pas saisi)
type NewDossierForm = Omit<Partial<Dossier>, 'amount' | 'disputeValue'> & {
  amount?: number | string;
  disputeValue?: number | string;
};
// Formulaire de traitement d'un dossier : champs du dossier (montants tels que saisis) et
// qualification de clôture ou motif de réouverture
type EditForm = Omit<Partial<Dossier>, 'credit' | 'disputeValue' | 'compensation' | 'indemTps'> & {
  credit?: number | string;
  disputeValue?: number | string;
  compensation?: number | string;
  indemTps?: number | string;
  verdict?: string;
  reason?: string;
  reopenReason?: string;
};
// Action envoyée à l'API (POST /api/data) ou appliquée localement en démonstration.
// Les champs dépendent de l'action ; ceux du formulaire de traitement y sont recopiés.
type ActionPayload = Omit<EditForm, 'status'> & {
  action: string;
  status?: string;
  record?: NewDossierForm;
  commentId?: string;
  commentIds?: string[];
  keys?: string[];
  email?: string;
  name?: string;
  role?: string;
  types?: string[];
  sla?: SlaRule[];
  catalogs?: Catalogs;
  mailbox?: string;
  settings?: CreditSettingsData;
  view?: { name: string; filters: ListFilters };
  message?: TransportDraft;
  text?: string;
  mentions?: string[];
  // Autres champs propres à une action (demandes d'avoir : creditId, decision, amount…)
  [key: string]: unknown;
};
interface KpiProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  foot: ReactNode;
  accent: string;
  onClick: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NONE: any[] = [];
// Vue des responsables : dossiers pré-remplis d'après les échanges, pas encore vérifiés, et
// dossiers résolus dont la clôture est incomplète (résultat ou imputation manquant)
const TO_CHECK = 'À vérifier ou compléter';
const incompleteClosure = (x: Dossier) => x.status === 'Résolu' && (!x.outcome || !x.imputation);
const toCheck = (x: Dossier) => !!x.prefilled?.fields?.length || incompleteClosure(x);
const statuses = ['Nouveau', 'Pris en charge', 'En attente RC', 'Résolu', 'Réouvert'],
  // Le SAV déclare des litiges comme la Relation client (mêmes droits, même tableau de bord)
  roles = ['RC', 'SAV', 'Service Litige', 'Responsable', 'Admin'],
  roleLabel = (role: string) => (role === 'RC' ? 'Relation client' : role),
  roleIcon = (role: string, size?: number) =>
    role === 'RC' ? (
      <Users size={size} />
    ) : role === 'SAV' ? (
      <Wrench size={size} />
    ) : role === 'Service Litige' ? (
      <FolderOpen size={size} />
    ) : role === 'Responsable' ? (
      <ChartNoAxesCombined size={size} />
    ) : (
      <ShieldCheck size={size} />
    ),
  roleDescriptions: Record<string, string> = {
    RC: 'Reçoit les appels clients, crée les litiges, échange avec le service litige, répond aux demandes RC et réouvre les dossiers.',
    SAV: 'Déclare les litiges constatés à l’atelier (pièces abîmées, fraudes), suit ses dossiers et échange avec le service litige.',
    'Service Litige':
      'Prend en charge, qualifie (interne ou transporteur), échange avec les transporteurs, renseigne avoirs et indemnisations, clôture.',
    // Droits à définir : pour l'instant comme le Service Litige, avec Analyses litiges
    Responsable:
      'Traite les litiges comme le Service Litige et suit les analyses des litiges (droits à préciser).',
    Admin: 'Dispose de toutes les actions, administre les comptes, les listes et les délais (SLA).',
  },
  types0 = disputeTypes;
const money = (v: number | undefined) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0);
const date = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
const days = (a: string, b?: string | null) =>
  Math.max(0, ((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 86400000);
const agents0 = [
  { name: 'Claire Durand', email: 'claire@exemple.test', role: 'RC' },
  { name: 'Nadia Roux', email: 'nadia@exemple.test', role: 'SAV' },
  { name: 'Mathieu Petit', email: 'mathieu@exemple.test', role: 'Service Litige' },
  { name: 'Sophie Morel', email: 'sophie@exemple.test', role: 'Admin' },
];
// Numéro de suivi fictif pour la démonstration
function demoTrackingNumber(carrier: string, i: number) {
  const digits = (n: number) =>
    String(48151623 * (i + 7))
      .padEnd(n, '4')
      .slice(0, n);
  if (!carrier) return '';
  if (carrier === 'CHRONOPOST') return 'XN' + digits(9) + 'FR';
  if (carrier === 'COLISSIMO') return '6C' + digits(11);
  if (carrier === 'TNT') return digits(16);
  if (carrier === 'FEDEX') return digits(12);
  return '1G' + digits(10);
}

// Contentieux fictifs de la démonstration (espace Contentieux, responsables) : un à relier au
// dossier de la même commande, un déjà relié, un client qui en a deux, un clos avec ses coûts
function demoContentieux(): Contentieux[] {
  const ago = (n: number) => {
    const d = new Date(creditToday() + 'T00:00:00.000Z');
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const base = {
    brand: 'CYBERTEK',
    productRef: '',
    amount: null,
    decision: '',
    refund: null,
    surcharge: null,
    fees: null,
    returnedProductRef: '',
    priceGap: null,
    comment: '',
    declined: [],
    createdBy: 'Sophie Morel',
    version: 1,
  };
  return [
    {
      ...base,
      id: 'ct-demo-1',
      ref: 'CT-2026-D0001',
      receivedAt: ago(20),
      kind: 'Signal Conso (DGCCRF)',
      status: 'À traiter',
      customerAccount: 'C102938',
      order: 'CMD-84739',
      amount: 2450,
      subject: 'Transporteur',
      subSubject: 'Colis livré non reçu',
      comment: 'Signalement reçu via la plateforme Signal Conso.',
    },
    {
      ...base,
      id: 'ct-demo-2',
      ref: 'CT-2026-D0002',
      receivedAt: ago(45),
      kind: 'Médiation',
      status: 'Répondu',
      brand: 'GROSBILL',
      customerAccount: 'C102938',
      order: 'CMD-70011',
      amount: 349.9,
      subject: 'Rétractation',
      subSubject: 'Remboursement retardé / hors délai',
      decision: 'Remboursement',
      refund: 349.9,
    },
    {
      ...base,
      id: 'ct-demo-3',
      ref: 'CT-2026-D0003',
      receivedAt: ago(12),
      kind: 'Réclamation PayPal',
      status: 'À traiter',
      customerAccount: 'C554410',
      order: 'CMD-84700',
      amount: 329,
      subject: 'Transporteur',
      subSubject: 'Colis endommagé',
      dossierId: 'demo-4',
      dossierRef: 'LIT-2026-1280',
    },
    {
      ...base,
      id: 'ct-demo-4',
      ref: 'CT-2026-D0004',
      receivedAt: ago(60),
      kind: 'Courrier recommandé',
      status: 'Clos',
      customerAccount: 'C887766',
      // Relié à un dossier résolu indemnisé par le transporteur (80 €) : perte réelle déduite
      order: 'CMD-84687',
      dossierId: 'demo-5',
      dossierRef: 'LIT-2026-1279',
      productRef: 'PDT-106290',
      amount: 1199,
      subject: 'SAV PC',
      subSubject: 'Panne au déballage',
      decision: 'Remboursement + majoration',
      refund: 1199,
      surcharge: 245,
      fees: 5.86,
      returnedProductRef: 'PDT-106291',
      priceGap: 54.89,
      customerMessage:
        'Madame, Monsieur, par la présente je vous mets en demeure de me rembourser l’ordinateur reçu en panne, sans réponse de votre part depuis trois semaines.',
      customerReply:
        'Bonjour, nous vous confirmons le remboursement intégral de votre commande ainsi qu’un geste commercial. Le virement sera visible sous 5 jours ouvrés.',
      comment: 'Mise en demeure : remboursement et majoration réglés.',
    },
  ].map((c) => ({
    ...c,
    createdAt: c.receivedAt + 'T09:00:00.000Z',
    history: [
      {
        date: c.receivedAt + 'T09:00:00.000Z',
        text: 'Contentieux enregistré',
        author: 'Sophie Morel',
      },
    ],
  }));
}

function fixtures() {
  return [
    'Vitre du boîtier brisée à réception',
    'Colis déclaré livré, non reçu',
    'Carte graphique absente du colis',
    'PC monté : câblage défectueux',
    'Écran endommagé pendant le transport',
    'Erreur sur la référence de la RAM',
    'Colis perdu en cours de livraison',
    'PC reçu avec un panneau enfoncé',
    'Accessoire manquant dans la commande',
    'Processeur non conforme',
    'Écran reçu avec une dalle fissurée',
    'Contestation de livraison',
  ].map((title, i) => {
    const created = new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      status = statuses[[0, 1, 2, 1, 0, 3, 1, 4, 3, 2, 3, 1][i]],
      closed = status === 'Résolu' ? new Date(Date.now() - (i - 2) * 86400000).toISOString() : null;
    return {
      brand: brands[i % brands.length],
      store: brands[i % brands.length] === STORE_BRAND ? stores[(i * 5) % stores.length] : '',
      productType: products[i % products.length],
      productRef: 'PDT-' + (106200 + i),
      creditNumber: status === 'Résolu' ? 'AV-DEMO-' + (1000 + i) : '',
      creditCreated: status === 'Résolu' ? closed?.slice(0, 10) : null,
      outcome: status === 'Résolu' ? outcomes[i % outcomes.length] : '',
      ticket: String(2184 + i),
      // Numéro de suivi d'exemple, à la forme de celui du transporteur (suivi simulé en démo)
      bt: demoTrackingNumber(i % 3 === 0 ? '' : carriers[i % carriers.length], i),
      requester: agents0[0].name,
      id: 'demo-' + i,
      ref: 'LIT-2026-' + (1284 - i),
      title,
      customer: [
        'Thomas Martin',
        'Léa Bernard',
        'Lucas Robert',
        'Emma Dubois',
        'Hugo Laurent',
        'Chloé Moreau',
        'Louis Simon',
        'Manon Michel',
        'Jules Lefebvre',
        'Camille Leroy',
        'Arthur Roux',
        'Sarah David',
      ][i],
      order: 'CMD-' + (84752 - i * 13),
      amount: [1899, 2450, 879, 1699, 329, 149, 2199, 1390, 89, 399, 549, 1199][i],
      origin: i % 3 === 0 ? 'Interne' : 'Transport',
      carrier: i % 3 === 0 ? '—' : carriers[i % carriers.length],
      carrierCaseRef: 'TRP-' + (4710 + i),
      carrierStatus: status === 'Résolu' ? 'Clos' : 'En attente réponse',
      clientStage: status === 'Résolu' ? 'Solution apportée' : 'En attente réponse transporteur',
      carrierSentAt: created.slice(0, 10),
      carrierFollowupAt: new Date(Date.now() + (i % 3 === 0 ? -1 : 2) * 86400000)
        .toISOString()
        .slice(0, 10),
      priority: [0, 1, 6].includes(i) ? 'Haute' : 'Normale',
      type: types0[i % 7],
      status,
      created,
      closed,
      reopened: status === 'Réouvert' ? [new Date().toISOString()] : [],
      creator: agents0[0].email,
      assignee: i % 2 ? agents0[1].email : '',
      creditIssued: status === 'Résolu',
      credit: status === 'Résolu' ? 149 : 0,
      compensation: status === 'Résolu' ? 80 : 0,
      // Côté transporteur : décision, valeur du litige, réponse (sauf un avoir anticipé)
      carrierDecision:
        status === 'Résolu' && i % 3 !== 0 ? ['Accepté', 'Refusé', 'Partiel'][i % 3] : '',
      disputeValue: status === 'Résolu' ? 149 : 0,
      carrierReplyAt:
        status === 'Résolu' && i !== 8
          ? new Date(Date.now() - (i - 1) * 86400000).toISOString().slice(0, 10)
          : '',
      description:
        'Le client a signalé un problème à la réception de sa commande. Les éléments transmis doivent être examinés pour déterminer la prise en charge et la solution à proposer.',
      resolution: status === 'Résolu' ? { verdict: 'Avéré', reason: 'Colis endommagé' } : null,
      comments: [
        {
          id: 'c' + i,
          text: 'Dossier transmis avec les éléments du client. Merci de vérifier la prise en charge.',
          author: 'Claire Durand',
          date: created,
          mentions: [],
        },
      ],
      history: [
        {
          date: created,
          text: 'Dossier créé et transmis au service litige',
          author: 'Claire Durand',
        },
      ],
      version: 1,
    };
  });
}
// Listes métier par défaut (Paramètres) et aide affichée sous chaque titre
const DEFAULT_LISTS: Record<string, string[]> = {
  types: types0,
  brands,
  stores,
  products,
  outcomes,
  carriers,
  ...DEFAULT_STAGES,
};
const LIST_HELP: Record<string, string> = {
  types: 'Proposés à l’ouverture d’un litige ; servent aux statistiques par type.',
  brands: 'Enseignes du formulaire de création, avec leur couleur dans les listes.',
  stores: 'Proposés quand l’enseigne est « MAGASIN ».',
  products: 'Type de produit concerné par le litige.',
  outcomes: 'Résultat final indiqué à la clôture (fraudes, requalifications…).',
  carriers: 'Transporteurs proposés pour les litiges d’origine Transport.',
  carrierStages:
    'Suivi de la réclamation chez le transporteur. Les états verrouillés servent aux relances et aux statistiques.',
  clientStages: 'Suivi de la solution apportée au client.',
};

// Expéditions fictives des six derniers mois (démonstration du ratio litiges / expéditions)
function demoShipments() {
  const out: Record<string, Record<string, number>> = {};
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    out[month] = Object.fromEntries(
      carriers.map((c, j) => [c, [3200, 2100, 640, 420, 380, 260, 150][j] + i * 37]),
    );
  }
  return out;
}
function Badge({ status }: { status: string }) {
  return (
    <span className={'badge s' + statuses.indexOf(status)}>
      <i />
      {status}
    </span>
  );
}
export default function App() {
  const [demo, setDemo] = useState(DEMO_ENABLED),
    // Espace réel chargé : tant qu'il ne l'est pas, un écran de connexion remplace l'outil
    [booted, setBooted] = useState(DEMO_ENABLED),
    [signInLink, setSignInLink] = useState('/auth/connexion?return_to=/'),
    [data, setData] = useState<AppData>({
      records: fixtures(),
      members: agents0,
      types: types0,
      catalogs: { brands, products, outcomes, carriers, stores },
      me: agents0[0],
      shipments: demoShipments(),
      contentieux: demoContentieux(),
    }),
    // Contentieux à ouvrir (ou à créer depuis un dossier litige) dans l'espace Contentieux
    [ctFocus, setCtFocus] = useState<ContentieuxFocus>(null),
    // Paramètres : partie litiges ou contentieux
    [settingsTab, setSettingsTab] = useState<'litiges' | 'transporteurs' | 'contentieux'>(
      'litiges',
    ),
    [view, setView] = useState('RC'),
    [page, setPage] = useState('today'),
    [q, setQ] = useState(''),
    [filter, setFilter] = useState('Tous'),
    [origin, setOrigin] = useState('Toutes'),
    [scope, setScope] = useState('Tous les dossiers'),
    [period, setPeriod] = useState('30'),
    [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState(''),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notifications, setNotifications] = useState(false),
    [alertTab, setAlertTab] = useState(''),
    [adv, setAdv] = useState<AdvancedFilters>({ ...EMPTY_ADVANCED }),
    // Dossiers cochés dans la liste (actions groupées)
    [pickedState, setPickedState] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] }),
    // Rapport affiché (à la demande depuis Analyses, ou rapport programmé reçu)
    [reportView, setReportView] = useState<{
      title: string;
      filters: Record<string, string>;
      kind: 'monthly' | 'weekly' | 'range';
      periodKey: string;
      from?: string;
      to?: string;
      manual?: boolean;
    } | null>(null),
    // Filtres d'« Analyses & rapports » (enseigne, transporteur…) : tout l'écran les suit
    [aFilters, setAFilters] = useState<AnalyticsFilters>({ ...EMPTY_ANALYTICS }),
    // Liste ouverte depuis les analyses (« Voir les dossiers concernés ») : mêmes filtres
    [listAFilters, setListAFilters] = useState<AnalyticsFilters | null>(null),
    // Horloge des délais (SLA) : uniquement dans le navigateur (0 pendant le rendu serveur,
    // sinon l'affichage diffère d'une milliseconde à l'autre), mise à jour chaque minute
    [slaNow, setSlaNow] = useState(0),
    [tab, setTab] = useState('Échanges'),
    [form, setForm] = useState<NewDossierForm>({}),
    // Pièces jointes choisies à la création, envoyées une fois le dossier créé
    [newFiles, setNewFiles] = useState<File[]>([]),
    // Présentation de la liste : standard, ou « Suivi de bout en bout » (client + transporteur)
    [listMode, setListMode] = useState<'standard' | 'tracking'>('standard'),
    // Tri de la liste par date de déclaration : plus récentes d'abord (par défaut) ou l'inverse
    [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'),
    // Nombre de lignes affichées dans la liste (« Afficher les suivants » en ajoute)
    [shown, setShown] = useState(100),
    // Dossier que l'on vient de quitter : la liste défile jusqu'à lui et le fait clignoter
    [returnTo, setReturnTo] = useState<string | null>(null),
    // Dossier ouvert depuis la liste et ses voisins (retour sur la bonne ligne, dossier suivant)
    [listNeighbors, setListNeighbors] = useState<{
      id: string;
      next?: string;
      prev?: string;
    } | null>(null),
    [edit, setEdit] = useState<EditForm>({}),
    [memberForm, setMemberForm] = useState<Partial<Member>>({}),
    // Profils d'une adresse partagée (Équipe & accès)
    [profileForm, setProfileForm] = useState({ email: '', value: '' }),
    [mailbox, setMailbox] = useState(''),
    // Espace réel : la liste ne contient qu'un résumé de chaque dossier ; le dossier ouvert
    // est chargé en entier (commentaires, historique, données source) dans `detail`.
    [detail, setDetail] = useState<Dossier | null>(null),
    // Commentaires arrivés en direct (mis en évidence quelques secondes)
    [arrived, setArrived] = useState<string[]>([]),
    loadSeq = useRef(0),
    // Identifiant du dernier dossier créé (pour y joindre les fichiers du formulaire)
    createdId = useRef(''),
    lastLoad = useRef(0);
  useEffect(() => {
    if (!DEMO_ENABLED) return;
    try {
      const v2 = localStorage.getItem('rclient-demo-v2');
      const s = v2 || localStorage.getItem('rclient-demo-v1');
      if (s) {
        // Démonstration enregistrée avant le renommage du rôle Responsables en Admin
        const parsed = JSON.parse(s.replaceAll('"Responsables"', '"Admin"'));
        // Restauration de la démonstration après le premier rendu : le serveur n'a pas accès à
        // localStorage, un état initial lu ici ferait différer le rendu serveur et navigateur.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView(roles.includes(parsed.me?.role) ? parsed.me.role : 'RC');
        setData({
          ...parsed,
          // Comptes fictifs ajoutés depuis (ex. agent SAV) : complétés dans la démonstration
          members: [
            ...(parsed.members || []),
            ...agents0.filter(
              (a) => !(parsed.members || []).some((m: Member) => m.email === a.email),
            ),
          ],
          types: v2 ? parsed.types : types0,
          catalogs: {
            brands,
            products,
            outcomes,
            carriers,
            stores,
            ...parsed.catalogs,
            // Enseignes revues le 10/11/2026 (avec « MAGASIN ») : remplacent l'ancienne liste
            ...(parsed.catalogs?.brands?.includes(STORE_BRAND) ? {} : { brands }),
          },
          shipments: parsed.shipments || demoShipments(),
          contentieux: parsed.contentieux || demoContentieux(),
        });
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (demo) localStorage.setItem('rclient-demo-v2', JSON.stringify(data));
  }, [data, demo]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 4500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  // silent : actualisation automatique, qui ne touche pas aux formulaires en cours de saisie
  async function load(silent = false) {
    const seq = ++loadSeq.current;
    const res = await fetch('/api/data', { cache: 'no-store' }),
      d = (await res.json()) as AppData & { error?: string };
    if (!res.ok) {
      const failed = new Error(d.error) as Error & { signIn?: string };
      if (typeof d.signIn === 'string' && d.signIn.startsWith('/')) {
        setSignInLink(d.signIn);
        failed.signIn = d.signIn;
      }
      throw failed;
    }
    // Une réponse plus ancienne qu'un chargement lancé après elle est ignorée
    if (seq !== loadSeq.current) return d;
    lastLoad.current = Date.now();
    if (typeof d.signIn === 'string' && d.signIn.startsWith('/')) setSignInLink(d.signIn);
    setData(d);
    setView(d.me.role);
    if (silent) return d;
    setMailbox(d.mailbox || '');
    return d;
  }
  useEffect(() => {
    // Page prête à réagir aux clics (utilisé par les tests d'interface, tests/ui)
    document.documentElement.dataset.ready = '1';
    const tick = () => setSlaNow(Date.now());
    tick();
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, []);
  // Ouverture du site sans démonstration : chargement de l'espace réel, ou renvoi vers la
  // connexion Microsoft quand l'agent n'est pas (ou plus) connecté
  useEffect(() => {
    if (DEMO_ENABLED) return;
    // Les états ne changent qu'à la réponse du serveur (après l'appel), pas pendant l'effet
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .then(() => {
        try {
          sessionStorage.removeItem(SIGN_IN_REDIRECT_KEY);
        } catch {}
        setBooted(true);
      })
      .catch((e: Error & { signIn?: string }) => {
        if (e.signIn) {
          let recent = false;
          try {
            recent = Date.now() - Number(sessionStorage.getItem(SIGN_IN_REDIRECT_KEY) || 0) < 60000;
            sessionStorage.setItem(SIGN_IN_REDIRECT_KEY, String(Date.now()));
          } catch {}
          if (!recent) {
            window.location.assign(e.signIn);
            return;
          }
        }
        setError(e.message || 'Connexion impossible. Réessayez.');
      });
    // Une seule fois à l'ouverture du site
  }, []);
  async function fetchDetail(id: string) {
    const res = await fetch('/api/data?id=' + encodeURIComponent(id), { cache: 'no-store' }),
      d = (await res.json()) as { record: Dossier; error?: string };
    if (!res.ok) throw new Error(d.error);
    setDetail(d.record);
    return d.record;
  }
  // Bouton « retour » du navigateur ou de la souris : chaque écran (menu) et chaque dossier
  // ouvert est une étape de l'historique ; revenir en arrière rouvre l'écran ou le dossier
  // précédent au lieu de quitter l'outil (et de repasser par la connexion).
  const restoring = useRef<{ page: string; selected: string | null } | null>(null);
  const popRef = useRef<(s: { page: string; selected: string | null }) => void>(() => {});
  useEffect(() => {
    // Les repères internes de Next.js restent dans l'étape : sans eux, il recharge la page
    const state = { ...(window.history.state || {}), optilitige: 1, page, selected };
    const target = restoring.current;
    if (target) {
      // Retour en cours : on attend d'avoir rejoint l'étape visée, sans rien ajouter
      if (target.page === page && target.selected === selected) restoring.current = null;
      return;
    }
    const current = window.history.state;
    if (current?.optilitige && current.page === page && current.selected === selected) return;
    if (current?.optilitige) window.history.pushState(state, '');
    else window.history.replaceState(state, '');
  }, [page, selected]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (e.state?.optilitige) popRef.current({ page: e.state.page, selected: e.state.selected });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Actualisation automatique de la liste (espace réel) : toutes les minutes quand l'onglet
  // est visible, et au retour sur l'onglet. Le dossier ouvert n'est pas remplacé : un
  // bandeau propose de le recharger s'il a été modifié entre-temps.
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    if (demo) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || busyRef.current) return;
      if (Date.now() - lastLoad.current < 15000) return;
      load(true).catch(() => {});
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [demo]);
  async function switchMode() {
    setError('');
    if (!demo) {
      setDemo(true);
      setData({
        records: fixtures(),
        members: agents0,
        types: types0,
        catalogs: { brands, products, outcomes, carriers, stores },
        me: agents0[0],
        shipments: demoShipments(),
      });
      setView('RC');
      setSelected(null);
      setDetail(null);
      return;
    }
    setBusy(true);
    try {
      await load();
      setDemo(false);
      setSelected(null);
      setPage('today');
      setNotice('Espace de travail connecté');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  // Actions groupées sur les dossiers cochés (app/bulk-actions.mjs)
  // « Relance faite » (fiche ou Ma journée) : prochaine relance repoussée de N jours
  async function followupDone(x: Dossier) {
    const ok = await action({ action: 'carrier-followup-done', id: x.id } as ActionPayload);
    if (ok && selected === x.id)
      // Le formulaire ouvert suit la nouvelle date ; sa révision est déjà recalée par action()
      setEdit((previous) => ({
        ...previous,
        carrierFollowupAt: nextFollowup(parisToday(), carrierDelays),
      }));
  }
  async function bulkRun(
    op: 'assign' | 'status' | 'watch',
    value: string | boolean,
    ids: string[] = picked,
  ) {
    if (!ids.length) return;
    setBusy(true);
    setError('');
    try {
      let done = ids.length,
        skipped = 0;
      if (demo) {
        const n = { ...data };
        const now = new Date().toISOString();
        if (op === 'watch') {
          let list = data.watchingByUser?.[me.email] || [];
          for (const id of ids) list = toggleWatch(list, id, !!value).list || list;
          n.watchingByUser = { ...(data.watchingByUser || {}), [me.email]: list };
        } else {
          done = 0;
          n.records = data.records.map((r) => {
            if (!ids.includes(r.id)) return r;
            const copy = structuredClone(r);
            const reason = applyBulk(
              copy,
              { op, value: String(value) },
              {
                now,
                author: me.name,
                assigneeName: data.members.find((m) => m.email === value)?.name,
              },
            );
            if (reason) {
              skipped++;
              return r;
            }
            done++;
            return copy;
          });
        }
        setData(n);
      } else {
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            op === 'watch'
              ? { action: 'watch-many', ids, on: value }
              : { action: 'bulk', ids, op, value },
          ),
        });
        const d = (await res.json()) as { error?: string; done?: number; skipped?: unknown[] };
        if (!res.ok) throw new Error(d.error);
        if (op !== 'watch') {
          done = d.done || 0;
          skipped = d.skipped?.length || 0;
        }
        await load();
      }
      setNotice(
        op === 'watch'
          ? value
            ? 'Vous suivez ' + done + ' dossier(s)'
            : 'Vous ne suivez plus ' + done + ' dossier(s)'
          : done +
              ' dossier(s) modifié(s)' +
              (skipped ? ' · ' + skipped + ' ignoré(s) (déjà à jour ou passage non autorisé)' : ''),
      );
      setPicked([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function action(p: ActionPayload) {
    setBusy(true);
    setError('');
    let claimed = 0;
    try {
      if (demo) {
        const n = { ...data };
        const now = new Date().toISOString();
        if (p.action === 'create') {
          const id = crypto.randomUUID();
          createdId.current = id;
          n.records = [
            {
              ...p.record,
              id,
              ref: 'LIT-2026-' + id.slice(0, 6).toUpperCase(),
              created: now,
              status: 'Nouveau',
              statusSince: now,
              carrierStatus: 'À transmettre',
              clientStage: 'En attente réponse transporteur',
              creator: data.me.email,
              closed: null,
              reopened: [],
              credit: 0,
              creditIssued: false,
              compensation: 0,
              assignee: '',
              resolution: null,
              comments: [],
              history: [{ date: now, text: 'Dossier créé et transmis', author: data.me.name }],
              version: 1,
            } as Dossier,
            ...data.records,
          ];
        } else if (String(p.action).startsWith('contentieux-')) {
          // Espace Contentieux, comme sur le serveur (app/contentieux.mjs)
          if (view !== 'Admin') throw new Error('Espace réservé aux admins.');
          const list = data.contentieux || [];
          const current = p.id ? list.find((c) => c.id === p.id) || null : null;
          if (p.id && !current) throw new Error('Contentieux introuvable.');
          if (p.action === 'contentieux-settings') {
            const { error, settings } = normalizeContentieuxSettings(p.settings);
            if (error) throw new Error(error);
            n.contentieuxSettings = settings;
            if (p.applyToRecords) {
              const changed = applyContentieuxRenames(list, p.renames as [], {
                now,
                author: data.me.name,
              });
              n.contentieux = list.map((c) => changed.find((x) => x.id === c.id) || c);
            }
          } else if (p.action === 'contentieux-delete')
            n.contentieux = list.filter((c) => c.id !== p.id);
          else {
            const d = p.dossierId ? data.records.find((x) => x.id === p.dossierId) : null;
            const result = applyContentieuxAction(current, p, {
              now,
              today: creditToday(),
              author: data.me.name,
              newId: crypto.randomUUID(),
              dossier: d ? { id: d.id, ref: d.ref } : null,
              settings: data.contentieuxSettings || DEFAULT_CONTENTIEUX_SETTINGS,
            });
            if (result.error) throw new Error(result.error);
            if (!result.unchanged)
              n.contentieux = current
                ? list.map((c) => (c.id === current.id ? result.item : c))
                : [result.item, ...list];
          }
        } else if (p.action === 'read-notification') {
          const previous = n.notificationReadsByUser || {};
          n.notificationReadsByUser = {
            ...previous,
            [me.email]: Array.from(
              new Set([
                ...(previous[me.email] || []),
                ...(p.commentIds || [p.commentId]).map((id) => notificationKey(p.id, id)),
              ]),
            ),
          };
        } else if (String(p.action).startsWith('credit-') && p.action !== 'credit-settings') {
          let failure = '';
          n.records = data.records.map((r) => {
            if (r.id !== p.id) return r;
            const x = structuredClone(r);
            const result: CreditActionResult = applyCreditAction(
              x,
              { ...p, newId: crypto.randomUUID() },
              { ...me, role: view },
              data.creditSettings || DEFAULT_CREDIT_SETTINGS,
              now,
              creditToday(),
            );
            if (result.error) failure = result.error;
            return result.error ? r : { ...x, version: r.version + 1 };
          });
          if (failure) throw new Error(failure);
        } else if (p.action === 'view-add' || p.action === 'view-delete') {
          // Démonstration : une liste de vues par rôle, comme sur le serveur
          const roleViews = { ...(data.roleViews || {}) };
          const result = applyViewAction(
            roleViews[view] || [],
            p,
            me,
            now,
            'vue-' + crypto.randomUUID().slice(0, 8),
          );
          if (result.error) throw new Error(result.error);
          n.roleViews = { ...roleViews, [view]: result.views as SavedView[] };
        } else if (p.action === 'edit-info') {
          const current = data.records.find((x) => x.id === p.id)!;
          const { values, changes, error } = applyInfoEdit(
            current,
            p.info as Record<string, unknown>,
          );
          if (error) throw new Error(error);
          if (changes!.length)
            n.records = data.records.map((x) =>
              x.id === p.id
                ? ({
                    ...x,
                    ...values,
                    version: x.version + 1,
                    history: [
                      ...(x.history || []),
                      { date: now, text: changesText(changes!), author: data.me.name },
                    ],
                  } as Dossier)
                : x,
            );
        } else if (p.action === 'list-update') {
          const key = String(p.list) as keyof typeof LIST_DEFS;
          const current =
            key === 'types'
              ? data.types
              : (data.catalogs as unknown as Record<string, string[]>)?.[key] || DEFAULT_LISTS[key];
          const { values, renames, error } = normalizeListUpdate(key, p.values, p.renames, current);
          if (error) throw new Error(error);
          if (key === 'types') n.types = values!;
          else n.catalogs = { ...data.catalogs, [key]: values } as Catalogs;
          if (key === 'brands' && p.colors) n.brandColors = p.colors as Record<string, string>;
          if (p.applyToRecords && renames!.length) {
            const field = LIST_DEFS[key].field as keyof Dossier;
            n.records = data.records.map((x) => {
              const hit = renames!.find((rn: { from: string }) => x[field] === rn.from);
              return hit
                ? ({
                    ...x,
                    [field]: hit.to,
                    history: [
                      ...(x.history || []),
                      { date: now, text: renameText(key, hit.from, hit.to), author: data.me.name },
                    ],
                  } as Dossier)
                : x;
            });
          }
        } else if (p.action === 'claim-forms') {
          const { forms, error } = normalizeClaimForms(p.forms);
          if (error) throw new Error(error);
          n.claimForms = forms;
        } else if (p.action === 'tracking-links') {
          const { links, error } = normalizeTrackingLinks(p.links);
          if (error) throw new Error(error);
          n.trackingLinks = links;
        } else if (p.action === 'reports') {
          const { reports, error } = normalizeReports(
            p.reports,
            data.members.map((m) => m.email),
          );
          if (error) throw new Error(error);
          n.reports = reports as AppData['reports'];
        } else if (p.action === 'mail-signatures') {
          const { signatures, error } = normalizeSignatures(p.signatures);
          if (error) throw new Error(error);
          n.mailSignatures = signatures as AppData['mailSignatures'];
        } else if (p.action === 'claim-templates') {
          const { templates, error } = normalizeTemplates(p.templates);
          if (error) throw new Error(error);
          n.claimTemplates = templates;
        } else if (p.action === 'carrier-delays') {
          const { delays, error } = normalizeCarrierDelays(p.delays);
          if (error) throw new Error(error);
          n.carrierDelays = delays;
        } else if (p.action === 'carrier-followup-done') {
          const target = data.records.find((x) => x.id === p.id);
          if (!target?.carrierSentAt)
            throw new Error('Indiquez d’abord la date de transmission au transporteur.');
          const next = nextFollowup(parisToday(), carrierDelays);
          n.records = data.records.map((x) =>
            x.id === p.id
              ? {
                  ...x,
                  carrierFollowupAt: next,
                  history: [
                    ...(x.history || []),
                    {
                      date: now,
                      text:
                        'Relance transporteur faite · prochaine relance le ' +
                        next.split('-').reverse().join('/'),
                      author: me.name,
                    },
                  ],
                }
              : x,
          );
        } else if (p.action === 'repeat-alerts') {
          const { alerts, error } = normalizeRepeatAlerts(p.alerts);
          if (error) throw new Error(error);
          n.repeatAlerts = alerts;
        } else if (p.action === 'amount-alerts') {
          const { alerts, error } = normalizeAmountAlerts(p.alerts);
          if (error) throw new Error(error);
          n.amountAlerts = alerts;
        } else if (p.action === 'credit-settings') {
          n.creditSettings = p.settings;
        } else if (p.action === 'reminder-add' || p.action === 'reminder-delete') {
          const list = data.remindersByUser?.[me.email] || [];
          const result =
            p.action === 'reminder-add'
              ? addReminder(
                  list,
                  { recordId: p.id, date: p.date, note: p.note },
                  { id: crypto.randomUUID(), now },
                )
              : removeReminder(list, String(p.reminderId || ''));
          if (result.error) throw new Error(result.error);
          n.remindersByUser = { ...(data.remindersByUser || {}), [me.email]: result.list! };
        } else if (p.action === 'watch') {
          const { list, error } = toggleWatch(
            data.watchingByUser?.[me.email] || [],
            String(p.id || ''),
            !!p.on,
          );
          if (error) throw new Error(error);
          n.watchingByUser = { ...(data.watchingByUser || {}), [me.email]: list! };
        } else if (p.action === 'read-alert') {
          const previous = n.alertReadsByUser || {};
          n.alertReadsByUser = {
            ...previous,
            [me.email]: Array.from(new Set([...(previous[me.email] || []), ...p.keys!])),
          };
        } else if (p.action === 'member') {
          const previous = data.members.find((x) => x.email === p.email);
          n.members = [
            ...data.members.filter((x) => x.email !== p.email),
            { email: p.email, name: p.name, role: p.role } as Member,
          ];
          n.accessLog = [demoAccessEntry(me, previous, p), ...(data.accessLog || [])];
        } else if (p.action === 'types') n.types = p.types!;
        else if (p.action === 'sla') n.sla = p.sla;
        else if (p.action === 'catalogs') n.catalogs = p.catalogs!;
        else if (p.action === 'mailbox') n.mailbox = p.mailbox;
        else
          n.records = data.records.map((r) => {
            if (r.id !== p.id) return r;
            const x = { ...r, version: r.version + 1 };
            if (p.action === 'client-followup') {
              x.clientStage = p.clientStage;
              x.rcCheck = p.rcCheck;
              x.followUp = p.followUp;
              x.history = [
                ...(r.history || []),
                { date: now, text: 'Suivi client : ' + p.clientStage, author: data.me.name },
              ];
            } else if (p.action === 'transport') {
              x.transportMessages = [
                ...(r.transportMessages || []),
                {
                  ...p.message!,
                  id: crypto.randomUUID(),
                  author: data.me.name,
                  recorded: new Date().toISOString(),
                },
              ];
            } else if (p.action === 'comment')
              x.comments = [
                ...r.comments,
                {
                  id: crypto.randomUUID(),
                  text: p.text!,
                  author: data.me.name,
                  email: data.me.email,
                  date: now,
                  mentions: p.mentions,
                },
              ];
            else {
              const creditState = resolveCredit(r, p, new Date(now));
              Object.assign(x, {
                status: p.status,
                statusSince: r.status !== p.status ? now : r.statusSince,
                compensation: Number(p.compensation),
                assignee: p.assignee,
                assignedAt: (p.assignee || '') !== (r.assignee || '') ? now : r.assignedAt,
                outcome: p.outcome || '',
                imputation: p.imputation || '',
                invoice: p.invoice || '',
                carrierStatus: p.carrierStatus || '',
                rcCheck: p.rcCheck || '',
                rcManager: p.rcManager || '',
                solution: p.solution || '',
                disputeValue: Number(p.disputeValue || 0),
                solco: p.solco || '',
                compensationState: p.compensationState || '',
                carrierDecision: p.carrierDecision || '',
                indemTps: Number(p.indemTps || 0),
                followUp: p.followUp || '',
                carrierCaseRef: p.carrierCaseRef || '',
                carrierSentAt: p.carrierSentAt || '',
                carrierResponseDue: p.carrierResponseDue || '',
                carrierReplyAt: p.carrierReplyAt || '',
                carrierFollowupAt: p.carrierFollowupAt || '',
                clientStage: p.clientStage || '',
                takenAt: r.status === 'Nouveau' && p.status === 'Pris en charge' ? now : r.takenAt,
                ...creditState,
                creditIssuedAt: creditIssuedStamp(r, creditState, now),
              });
              x.history = [
                ...(r.history || []),
                {
                  date: now,
                  text:
                    r.status === x.status
                      ? 'Informations mises à jour'
                      : r.status + ' → ' + x.status,
                  author: data.me.name,
                },
              ];
              if (x.status === 'Résolu' && r.status !== 'Résolu') {
                x.closed = now;
                x.resolution = { verdict: p.verdict!, reason: p.reason! };
              }
              if (x.status === 'Réouvert' && r.status === 'Résolu') {
                x.closed = null;
                x.reopened = [...r.reopened, now];
                x.history.push({
                  date: now,
                  text: 'Motif : ' + p.reopenReason,
                  author: data.me.name,
                });
              }
            }
            return x;
          });
        setData(n);
      } else {
        const res = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          }),
          d = (await res.json()) as { error?: string; id?: string; claimed?: number };
        if (!res.ok) throw new Error(d.error);
        claimed = d.claimed || 0;
        if (p.action === 'create') createdId.current = d.id || '';
        // Détail d'abord, liste ensuite : la liste n'est ainsi jamais plus récente que le
        // dossier ouvert, et le bandeau « modifié par un collègue » ne clignote pas.
        if (p.action === 'record-delete') {
          // Dossier supprimé : retour à la liste, sans tenter de le relire
          setSelected(null);
          await load();
        } else if (p.id && detail?.id === p.id) {
          const fresh = await fetchDetail(p.id);
          if (p.action === 'comment') shareComments(p.id, fresh.comments || []);
          // Le formulaire de traitement reste ouvert : il prend la nouvelle révision du dossier,
          // sinon l'enregistrement suivant serait refusé comme une modification d'un collègue.
          // Après « Modifier les informations », il reprend aussi le montant corrigé.
          setEdit((prev) => ({
            ...prev,
            rev: fresh.rev,
            version: fresh.version,
            ...(p.action === 'edit-info' ? { disputeValue: stakeOf(fresh) } : {}),
          }));
        }
        // Notification ou alerte lue : seul ce repère change, pas besoin de recharger toute la liste
        if (p.action === 'read-notification' && p.id) {
          const keys = (p.commentIds || [p.commentId]).map((c) => notificationKey(p.id!, c!));
          setData((prev) => ({
            ...prev,
            readNotificationIds: [...new Set([...(prev.readNotificationIds || []), ...keys])],
          }));
        } else if (p.action === 'read-alert')
          setData((prev) => ({
            ...prev,
            readAlertKeys: [...new Set([...(prev.readAlertKeys || []), ...(p.keys || [])])],
          }));
        else await load();
      }
      setNotice(
        String(p.action).startsWith('contentieux-')
          ? (
              {
                'contentieux-save': 'Contentieux enregistré',
                'contentieux-link': 'Contentieux relié au dossier litige',
                'contentieux-decline': 'Liaison refusée : ce dossier ne sera plus proposé',
                'contentieux-unlink': 'Liaison retirée',
                'contentieux-delete': 'Contentieux supprimé',
                'contentieux-settings': 'Listes des contentieux enregistrées',
              } as Record<string, string>
            )[p.action]
          : p.action === 'read-notification' || p.action === 'read-alert'
            ? 'Notification marquée comme lue'
            : p.action === 'prefill-ok'
              ? 'Pré-remplissage vérifié'
              : p.action === 'carrier-followup-done'
                ? 'Relance notée : prochaine relance dans ' + carrierDelays.followupDays + ' jours'
                : p.action === 'carrier-delays'
                  ? 'Délais des relances enregistrés'
                  : p.action === 'reports'
                    ? 'Rapports programmés enregistrés'
                    : p.action === 'claim-templates'
                      ? 'Modèles de réclamation enregistrés'
                      : p.action === 'mail-signatures'
                        ? 'Signatures d’e-mail enregistrées'
                        : p.action === 'reminder-add'
                          ? 'Rappel programmé : il arrivera dans la cloche (Rappels) le jour venu'
                          : p.action === 'reminder-delete'
                            ? 'Rappel supprimé'
                            : p.action === 'watch'
                              ? p.on
                                ? 'Vous suivez ce dossier : ses nouveautés arriveront dans la cloche (Abonnements)'
                                : 'Vous ne suivez plus ce dossier'
                              : p.action === 'comment'
                                ? 'Commentaire ajouté'
                                : p.action === 'create'
                                  ? 'Dossier créé et transmis'
                                  : p.action === 'list-update'
                                    ? 'Liste enregistrée'
                                    : p.action === 'edit-info'
                                      ? 'Informations du dossier modifiées'
                                      : p.action === 'view-add'
                                        ? 'Vue enregistrée pour votre service'
                                        : p.action === 'view-delete'
                                          ? 'Vue supprimée'
                                          : String(p.action).startsWith('credit-') &&
                                              p.action !== 'credit-settings'
                                            ? 'Avoir mis à jour'
                                            : 'Modifications enregistrées',
      );
      // Ajout d'un compte : ses dossiers importés de SharePoint lui ont été rattachés
      if (claimed)
        setNotice(
          'Compte enregistré : ' +
            claimed +
            (claimed > 1
              ? ' dossiers importés lui sont rattachés'
              : ' dossier importé lui est rattaché'),
        );
      if (p.action === 'record-delete') setNotice('Dossier supprimé');
      if (p.action === 'welcometrack-sync') setNotice('Expéditions importées de Welcometrack');
      if (p.action === 'welcometrack-alert') setNotice('N° de l’alerte Welcometrack enregistré');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const records = data.records,
    me = data.me,
    admin = demo ? view === 'Admin' : me.role === 'Admin',
    // Vues de création (Relation client et SAV) : mêmes écrans et tableaux de bord
    creatorView = view === 'RC' || view === 'SAV',
    // Le Responsable a, pour l'instant, les écrans du Service Litige (droits à définir)
    litigeView = view === 'Service Litige' || view === 'Responsable',
    dashView = view === 'Responsable' ? 'Service Litige' : view,
    canEdit = treatsDisputes(demo ? view : me.role),
    // Demandes d'avoir en attente (menu « Avoirs à traiter »)
    creditsToDo = records.reduce((n, x) => n + openCredits(x).length, 0),
    canCreate = !['Service Litige', 'Responsable'].includes(demo ? view : me.role),
    listed = records.find((x) => x.id === selected),
    r = demo ? listed : detail && detail.id === selected ? detail : undefined,
    // Le dossier ouvert a été modifié par quelqu'un d'autre depuis son ouverture
    // (révision du contenu : un commentaire ne compte pas, il s'affiche déjà en direct)
    staleDetail = !demo && !!r && !!listed && (listed.rev || 0) > (r.rev || 0),
    // Seuils des contours orangé / rouge de la liste (Paramètres → Repères de montant)
    amountAlerts = data.amountAlerts || DEFAULT_AMOUNT_ALERTS,
    // Alerte client récidiviste (Paramètres → Alerte client récidiviste)
    repeatAlerts = data.repeatAlerts || DEFAULT_REPEAT_ALERTS,
    // Délais des relances transporteur (Paramètres → Relances transporteur)
    carrierDelays = data.carrierDelays || DEFAULT_CARRIER_DELAYS,
    // Listes modifiables dans Paramètres : états transporteur, étapes client, couleurs
    carrierStages: string[] = data.catalogs?.carrierStages || DEFAULT_STAGES.carrierStages,
    clientStages: string[] = data.catalogs?.clientStages || DEFAULT_STAGES.clientStages,
    brandColors: Record<string, string> = data.brandColors || DEFAULT_BRAND_COLORS,
    // Formats et disposition des graphiques choisis par le compte
    prefs = data.prefs || { charts: {}, layouts: {} },
    // Couleur de chaque enseigne (clair, et version éclaircie pour le mode sombre)
    brandStyles = Object.entries(brandColors)
      .filter(([, c]) => /^#[0-9a-f]{6}$/i.test(c))
      .map(
        ([b, c]) =>
          '.brand-name[data-brand="' +
          brandKey(b) +
          '"]{--brand-color:' +
          c +
          ';--brand-color-dark:' +
          darkVariant(c) +
          '}',
      )
      .join(''),
    // Demandeurs possibles : comptes actifs de l'équipe, l'agent connecté en premier
    requesterChoices = [
      me,
      ...(data.members || [])
        .filter((m) => m.email !== me.email && m.role !== 'Désactivé')
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    ];
  // Champs « avoir » du formulaire de traitement tenus à jour après une émission d'avoir
  useEffect(() => {
    if (!r) return;
    // Le formulaire de traitement suit les avoirs émis depuis l'onglet Avoirs (montant et n°
    // reportés dans le suivi financier) ; sans cela, l'enregistrer effacerait ces valeurs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdit((e) => ({
      ...e,
      creditNumber: r.creditNumber || '',
      credit: r.credit,
      creditCreated: r.creditCreated || '',
      creditIssued: r.creditIssued,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id, r?.creditNumber, r?.credit, r?.creditCreated]);
  // Préférences d'affichage du compte : mises à jour tout de suite à l'écran, puis
  // enregistrées en arrière-plan (sans recharger la liste des dossiers)
  function savePrefs(next: NonNullable<AppData['prefs']>) {
    setData((previous) => ({ ...previous, prefs: next }));
    if (!demo)
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prefs', prefs: next }),
      }).catch(() => setError('La préférence d’affichage n’a pas pu être enregistrée.'));
  }
  const chartPrefs = {
    formats: prefs.charts,
    layouts: prefs.layouts,
    setFormat: (chart: string, format: string) =>
      savePrefs({ ...prefs, charts: { ...prefs.charts, [chart]: format } }),
    setLayout: (screen: string, order: string[]) =>
      savePrefs({ ...prefs, layouts: { ...prefs.layouts, [screen]: order } }),
  };
  function selectDemoRole(role: string) {
    if (!demo || !roles.includes(role)) return;
    setScope('Tous les dossiers');
    setFilter('Tous');
    setView(role);
    setData((previous) => ({
      ...previous,
      me: previous.members.find((m) => m.role === role) || previous.me,
    }));
    if (!pageAllowed(page, role)) setPage('today');
  }
  async function open(x: Dossier) {
    if (!demo) {
      setBusy(true);
      setError('');
      try {
        x = await fetchDetail(x.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      } finally {
        setBusy(false);
      }
    }
    setSelected(x.id);
    // Ouvrir un dossier suivi vaut lecture de sa nouveauté (cloche → Abonnements)
    const seen = (categoryAlerts.watch || [])
      .filter((a) => a.record.id === x.id && a.unread)
      .map((a) => a.key);
    if (seen.length) {
      if (demo)
        setData((previous) => ({
          ...previous,
          alertReadsByUser: {
            ...(previous.alertReadsByUser || {}),
            [me.email]: [...(previous.alertReadsByUser?.[me.email] || []), ...seen],
          },
        }));
      else {
        setData((previous) => ({
          ...previous,
          readAlertKeys: [...(previous.readAlertKeys || []), ...seen],
        }));
        fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read-alert', keys: seen }),
        }).catch(() => {});
      }
    }
    // La fiche s'ouvre en haut de page (référence, commande, informations)
    window.scrollTo(0, 0);
    setEdit({
      ...x,
      verdict: x.resolution?.verdict || 'Avéré',
      reason: x.resolution?.reason || data.types[0],
      reopenReason: '',
      outcome: x.outcome || '',
      imputation: x.imputation || '',
      creditNumber: x.creditNumber || '',
      invoice: x.invoice || '',
      carrierStatus: x.carrierStatus || '',
      rcCheck: x.rcCheck || '',
      rcManager: x.rcManager || '',
      creditCreated: x.creditCreated || '',
      solution: x.solution || '',
      // Même montant que la fiche (montant de commande des anciens dossiers qui n'en ont pas)
      disputeValue: stakeOf(x),
      solco: x.solco || '',
      compensationState: x.compensationState || '',
      carrierDecision: x.carrierDecision || '',
      indemTps: x.indemTps || 0,
      followUp: followUpText(x.followUp),
      carrierCaseRef: x.carrierCaseRef || '',
      carrierSentAt: x.carrierSentAt || '',
      carrierResponseDue: x.carrierResponseDue || '',
      carrierReplyAt: x.carrierReplyAt || '',
      carrierFollowupAt: x.carrierFollowupAt || '',
      clientStage: x.clientStage || 'En attente réponse transporteur',
    });
    setTab('Échanges');
    setError('');
  }
  function nav(p: string) {
    setPage(p);
    setSelected(null);
    setPicked([]);
    setQ('');
    setFilter('Tous');
    setOrigin('Toutes');
    setScope('Tous les dossiers');
    setAdv({ ...EMPTY_ADVANCED });
    setError('');
  }
  // Retour arrière (voir plus haut) : rouvre l'écran et, s'il y en avait un, le dossier.
  // Fonction remise à jour après chaque affichage (elle lit la liste et l'écran du moment).
  const goBackTo = (s: { page: string; selected: string | null }) => {
    if (s.page === page && s.selected === selected) return;
    const record = s.selected ? records.find((x) => x.id === s.selected) : undefined;
    const goal = { page: s.page, selected: record ? record.id : null };
    restoring.current = goal;
    setPage(goal.page);
    setError('');
    if (!record) {
      // Sortie d'un dossier : comme « Retour aux dossiers », la liste redescend jusqu'à sa
      // ligne, qui clignote en bleu
      if (selected) setReturnTo(selected);
      setSelected(null);
      return;
    }
    open(record).finally(() =>
      // Dossier non rouvert (erreur) : on ne bloque pas les étapes suivantes
      setTimeout(() => {
        if (restoring.current === goal) restoring.current = null;
      }, 0),
    );
  };
  const cards = kpiCards(records, dashView, me.email);
  // Listes de l'espace Contentieux (Paramètres → Contentieux)
  const ctSettings = data.contentieuxSettings || DEFAULT_CONTENTIEUX_SETTINGS;
  // Espace Contentieux (responsables) : à traiter, et délai légal dépassé
  const ctToday = creditToday();
  const ctOpenList = admin ? (data.contentieux || []).filter((c) => c.status === 'À traiter') : [];
  const ctOpen = ctOpenList.length;
  const ctLate = ctOpenList.some((c) => (contentieuxDaysLeft(c, ctToday) ?? 0) < 0);
  // Bas de la liste : tous les dossiers, sans filtre ni recherche, toutes périodes
  function showAllDossiers() {
    setSelected(null);
    setPage('dossiers');
    setQ('');
    setFilter('Tous');
    setOrigin('Toutes');
    setScope('Tous les dossiers');
    setPeriod('99999');
    setAdv({ ...EMPTY_ADVANCED });
    setListAFilters(null);
    setError('');
    setTimeout(() => {
      document.querySelector('.table-controls')?.scrollIntoView({ block: 'start' });
    }, 50);
  }
  function showKpi(scope: string) {
    setSelected(null);
    setPage('dossiers');
    setQ('');
    setFilter('Tous');
    setOrigin('Toutes');
    setPeriod('99999');
    setScope(scope);
    setError('');
  }
  // Délais (SLA) : règles des responsables (ou par défaut) et dossiers hors délai
  // Analyses & rapports : dossiers retenus par la barre de filtres (la période s'applique ensuite)
  const analyticsRecords: Dossier[] =
    page === 'analytics' ? filterAnalytics(records, aFilters, data.members) : records;
  const listOf = (
    base: string[] | undefined,
    key: 'brand' | 'carrier' | 'type' | 'productType' | 'store',
    sort = true,
  ) => {
    const all = [
      ...new Set([...(base || []), ...(records.map((x) => x[key]).filter(Boolean) as string[])]),
    ];
    return sort ? all.sort((a, b) => a.localeCompare(b, 'fr')) : all;
  };
  const analyticsOptions =
    page === 'analytics' || page === 'settings'
      ? {
          brands: listOf(data.catalogs?.brands || brands, 'brand', false),
          stores: listOf(data.catalogs?.stores || stores, 'store'),
          carriers: listOf(data.catalogs?.carriers || carriers, 'carrier'),
          types: listOf(data.types, 'type'),
          products: listOf(data.catalogs?.products || products, 'productType', false),
          members: (data.members || []).map((m) => ({ email: m.email, name: m.name })),
        }
      : { brands: [], stores: [], carriers: [], types: [], products: [], members: [] };
  const creditSettings = data.creditSettings || DEFAULT_CREDIT_SETTINGS;
  const slaRules = data.sla || DEFAULT_SLA,
    lateOf = (x: Dossier) => lateRules(x, slaRules, slaNow),
    lateCount = records.filter((x) => lateOf(x).length > 0).length;
  // Recherche : le champ suit la frappe tout de suite, la liste se met à jour juste après
  // (la saisie reste fluide même avec plus de 1 000 dossiers)
  const searchQuery = useDeferredValue(q);
  // Aide « Qui fait quoi, et quand » de la fiche : masquée = plus de place pour le dossier
  const guideOpen = useHelpOpen(GUIDE_HELP);
  // Ouverture depuis l'onglet : l'aide glisse du bord droit vers sa colonne
  const [guideSlide, setGuideSlide] = useState(false);
  // Échanges en direct dans le dossier ouvert (espace réel, app/live-comments.ts)
  useLiveComments(!demo && r ? r.id : null, (id, comments) => {
    if (!detail || detail.id !== id || sameComments(detail.comments, comments)) return;
    const known = new Set((detail.comments || []).map((c) => c.id));
    const fromOthers = comments.filter((c) => !known.has(c.id) && c.email !== me.email);
    setDetail((prev) => (prev && prev.id === id ? { ...prev, comments } : prev));
    if (fromOthers.length) {
      setArrived(fromOthers.map((c) => c.id));
      setNotice(
        fromOthers.length === 1
          ? 'Nouveau message de ' + fromOthers[0].author
          : fromOthers.length + ' nouveaux messages dans ce dossier',
      );
    }
  });
  // Actions groupées : la sélection appartient à la liste affichée ; changer de filtre, de tri
  // ou de page la vide (on n'agit jamais sur des dossiers devenus invisibles)
  const pickKey = JSON.stringify([
    q,
    filter,
    origin,
    scope,
    period,
    adv,
    page,
    sortOrder,
    listAFilters,
  ]);
  // Analyses → liste : mêmes période et filtres (enseigne, magasin, agent, priorité…), statut au choix
  const openAnalyticsList = (status = 'Tous') => {
    setPage('dossiers');
    setFilter(status);
    setQ('');
    setOrigin('Toutes');
    setScope('Tous les dossiers');
    setAdv({ ...EMPTY_ADVANCED });
    setListAFilters(countAnalytics(aFilters) ? { ...aFilters } : null);
    // Directement à la liste (le tableau de bord du service est au-dessus)
    setTimeout(() => {
      const list = document.querySelector('.analytics-list-note, .table-controls');
      if (list) window.scrollTo({ top: list.getBoundingClientRect().top + window.scrollY - 90 });
    }, 60);
  };
  const picked = pickedState.key === pickKey ? pickedState.ids : NONE;
  const setPicked = (ids: string[]) => setPickedState({ key: pickKey, ids });
  // Dossiers retenus par tous les filtres sauf le statut (compteurs des onglets de statut)
  const beforeStatus: Dossier[] = kpiRows(records, scope, me.email).filter(
    (x: Dossier) =>
      (origin === 'Toutes' || x.origin === origin) &&
      (scope !== 'Mes dossiers' || x.creator === me.email || x.assignee === me.email) &&
      (scope !== 'Relances transporteur' || overdueCarrier(x)) &&
      (scope !== 'Hors délai (SLA)' || lateOf(x).length > 0) &&
      (scope !== 'Avoirs en cours' || openCredits(x).length > 0) &&
      (scope !== TO_CHECK || toCheck(x)) &&
      (scope !== 'En attente transporteur' || waitingCarrier(x)) &&
      matchesSearch(x, searchQuery) &&
      inPeriod(x.created, period) &&
      matchesAdvanced(x, adv, data.members) &&
      (!listAFilters || matchesAnalytics(x, listAFilters, data.members)),
  );
  // Vue des responsables « À vérifier » : nombre restant (bouton en haut de la liste)
  const toCheckCount = admin ? records.filter(toCheck).length : 0;
  const openToCheck = () => {
    setPage('dossiers');
    setScope(TO_CHECK);
    setFilter('Tous');
    setPeriod('99999');
    // Directement à la liste (le tableau de bord est au-dessus)
    setTimeout(() => {
      const list = document.querySelector('.to-check-note, .table-controls');
      if (list) window.scrollTo({ top: list.getBoundingClientRect().top + window.scrollY - 160 });
    }, 60);
  };
  const filtered: Dossier[] = beforeStatus.filter((x) => filter === 'Tous' || x.status === filter);
  // Ouverture depuis la liste : on retient les voisins du dossier. S'il sort de la liste après
  // enregistrement (vue « À vérifier ou compléter », filtre de statut…), le retour se place
  // sur le suivant au lieu de remonter en haut.
  const openFromList = (x: Dossier) => {
    const at = filtered.findIndex((y) => y.id === x.id);
    setListNeighbors({
      id: x.id,
      next: at >= 0 ? filtered[at + 1]?.id : undefined,
      prev: at >= 0 ? filtered[at - 1]?.id : undefined,
    });
    open(x);
  };
  // Adresse partagée (ex. boîte du Service Litige) : profil choisi, retenu sur ce poste par un
  // cookie lu par le serveur ; '' pour en changer (la fenêtre « Qui êtes-vous ? » revient)
  const chooseProfile = async (name: string) => {
    document.cookie =
      'optilitige_profil=' +
      encodeURIComponent(name) +
      '; path=/; SameSite=Lax; max-age=' +
      (name ? 31536000 : 0);
    await load();
  };
  // Équipe & accès : les adresses de connexion (un compte, même s'il a plusieurs profils)
  const teamAccounts = data.accounts || data.members;
  // Traitement : chaque changement passe par les règles qui remplissent le reste seul
  // (imputation proposée, champs transporteur ; app/treatment-rules.mjs)
  const setTreat = (patch: EditForm) =>
    setEdit((previous) => applyTreatmentRules(previous, { ...previous, ...patch }, creditToday()));
  // Enregistrement du traitement (formulaire ou fenêtre « Clôturer ») ; la conclusion de la
  // clôture est déduite du résultat
  const saveTreatment = (base: Dossier, values: EditForm) =>
    action({
      ...values,
      verdict: verdictOf(String(values.outcome || '')),
      reason: String(values.outcome || ''),
      action: 'update',
      id: base.id,
      version: base.version,
      // Révision au moment où le formulaire a été rempli (pas celle d'un rechargement)
      rev: (values as { rev?: number }).rev || 0,
    } as ActionPayload);
  // Dossier suivant de la liste d'où le dossier a été ouvert (bouton « … et dossier suivant »)
  const nextInList = (id: string) => {
    if (listNeighbors?.id !== id || !listNeighbors.next) return undefined;
    return records.find((x) => x.id === listNeighbors.next);
  };
  // Dossiers que la période choisie laisse de côté (message « hors période » sous les onglets)
  const outsidePeriod =
    period === '99999' ? 0 : records.filter((x) => !inPeriod(x.created, period)).length;
  // Retour à la liste depuis un dossier : défilement jusqu'à sa ligne, puis courte animation
  useEffect(() => {
    if (!returnTo || selected) return;
    // Dossier sorti de la liste depuis son ouverture : on se place sur son voisin
    const n = listNeighbors;
    const inList = (id?: string) => !!id && filtered.some((x) => x.id === id);
    const target = inList(returnTo)
      ? returnTo
      : n?.id === returnTo
        ? [n.next, n.prev].find(inList) || returnTo
        : returnTo;
    const index = filtered.findIndex((x) => x.id === target);
    if (index >= shown) {
      // Ligne pas encore affichée (au-delà des 300 premières) : on l'affiche d'abord
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(index + 50);
      return;
    }
    // Après l'affichage de la liste (setTimeout : fonctionne aussi dans un onglet en arrière-plan)
    const timer = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(
        'tr[data-record-id="' + CSS.escape(target) + '"]',
      );
      setReturnTo(null);
      if (!row) return;
      row.scrollIntoView({ block: 'center' });
      row.classList.remove('row-flash');
      void row.offsetWidth; // relance l'animation si elle vient de jouer
      row.classList.add('row-flash');
      window.setTimeout(() => row.classList.remove('row-flash'), 1600);
    }, 30);
    return () => window.clearTimeout(timer);
    // La liste filtrée est relue à chaque passage ; seuls ces trois états déclenchent l'effet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnTo, selected, shown]);
  const statusCount = (s: string) =>
    s === 'Tous' ? beforeStatus.length : beforeStatus.filter((x) => x.status === s).length;
  // Tri par date de déclaration (la vue d'ensemble montre toujours les plus récents)
  const newestFirst = sortOrder === 'desc' || page === 'overview';
  filtered.sort((a, b) =>
    newestFirst ? b.created.localeCompare(a.created) : a.created.localeCompare(b.created),
  );
  // Dossiers déjà ouverts pour la commande saisie dans le formulaire de création
  const duplicates = modal === 'new' ? sameOrderRecords(records, form.order) : [];
  const active = records.filter((x) => x.status !== 'Résolu'),
    sum = (key: keyof Dossier, rows = records) =>
      rows.reduce((n: number, x) => n + Number(x[key]), 0);
  // Notifications, « Ma journée », clients : calculés une fois par changement de données
  // (app/use-workload.ts), pas à chaque frappe
  const { alerts, categoryAlerts, myDay, watching, customers } = useWorkload({
    records,
    me,
    role: demo ? view : me.role,
    rules: slaRules,
    slaNow,
    mentionReads:
      (demo ? data.notificationReadsByUser?.[me.email] : data.readNotificationIds) || NONE,
    alertReads: (demo ? data.alertReadsByUser?.[me.email] : data.readAlertKeys) || NONE,
    watchList: (demo ? data.watchingByUser?.[me.email] : data.watching) || NONE,
    reminders: (demo ? data.remindersByUser?.[me.email] : data.reminders) || NONE,
    reports: data.reports || NONE,
  });
  // Rappels personnels (« Me rappeler le… », app/reminders.mjs)
  const reminders = (demo ? data.remindersByUser?.[me.email] : data.reminders) || NONE;
  const unread = alerts.filter((a) => a.unread).length;
  const alertCounts: Record<string, number> = {
      mentions: unread,
      ...Object.fromEntries(
        Object.entries(categoryAlerts).map(([k, list]) => [k, list.filter((a) => a.unread).length]),
      ),
    },
    totalUnread = Object.values(alertCounts).reduce((n: number, v) => n + v, 0) as number,
    // Onglet ouvert : celui choisi, sinon le premier qui a du non lu
    currentAlertTab =
      alertTab || ALERT_CATEGORIES.find((c) => alertCounts[c.id] > 0)?.id || 'mentions';
  // Bouton « retour » : la fonction de retour lit l'écran et la liste du moment
  useEffect(() => {
    popRef.current = goBackTo;
  });

  async function importRecords(items: ImportItem[], fileName: string) {
    setBusy(true);
    setError('');
    let imported = 0,
      skipped = 0;
    try {
      if (demo) {
        const existing = new Set(records.map((x) => x.id));
        const additions: Dossier[] = [];
        for (const x of items) {
          const key = x.sourceList + '|' + (x.externalId || JSON.stringify(x.sourceData));
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))),
          )
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          const id = 'import-' + hash;
          if (existing.has(id)) {
            skipped++;
            continue;
          }
          existing.add(id);
          additions.push({
            ...x,
            id,
            importedAt: new Date().toISOString(),
            importFile: fileName,
            ref: 'IMP-' + (x.externalId || hash.slice(0, 7).toUpperCase()),
            creator: me.email,
            comments: x.historicalNotes
              ? [
                  {
                    id: crypto.randomUUID(),
                    author: 'Historique importé',
                    text: x.historicalNotes,
                    date: x.created,
                    mentions: [],
                  },
                ]
              : [],
            history: [
              {
                date: x.created,
                text: 'Ouverture selon la source Microsoft Lists',
                author: 'Migration',
              },
              {
                date: new Date().toISOString(),
                text: 'Import depuis ' + fileName + ' · statut repris : ' + x.status,
                author: me.name,
              },
            ],
            version: 1,
          } as Dossier);
          imported++;
        }
        setData({ ...data, records: [...additions, ...records] });
      } else {
        for (let i = 0; i < items.length; i += 50) {
          const res = await fetch('/api/data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'import', records: items.slice(i, i + 50), fileName }),
            }),
            d = (await res.json()) as { imported: number; skipped: number; error?: string };
          if (!res.ok)
            throw new Error(
              d.error + ' (' + imported + ' déjà importés, ' + skipped + ' doublons ignorés)',
            );
          imported += d.imported;
          skipped += d.skipped;
        }
        await load();
      }
      setPeriod('99999');
      setPage('dossiers');
      setFilter('Tous');
      setOrigin('Toutes');
      setScope('Tous les dossiers');
      setQ('');
      setNotice(imported + ' dossiers importés');
      return { imported, skipped };
    } finally {
      setBusy(false);
    }
  }
  // sourceRows : dossiers à exporter ; sinon (appel direct par un bouton, qui transmet
  // l’événement du clic) la liste filtrée
  function exportCSV(sourceRows?: unknown) {
    // Vue « Suivi de bout en bout » : export avec les mêmes colonnes que l'écran
    if (!Array.isArray(sourceRows) && listMode === 'tracking' && page === 'dossiers') {
      const blob = new Blob([trackingCsv(filtered)], { type: 'text/csv;charset=utf-8;' }),
        a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'optilitige-suivi-bout-en-bout.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    const headers = [
      'Référence',
      'Client',
      'Compte client',
      'Commande',
      'Montant commande',
      'Enseigne',
      'Magasin',
      'Type produit',
      'Référence produit',
      'Demandeur',
      'Ticket',
      'BT',
      'Résultat litige',
      'Imputation',
      'Numéro avoir',
      'Numéro facture',
      'Création avoir',
      'Prise en charge',
      'Valeur litige TTC',
      'Check RC',
      'Suivi responsable RC',
      'Statut transporteur',
      'Solco',
      'Solution',
      'Indemnisation état',
      'Indem tps',
      'Assurer un suivi',
      'Réf réclamation transporteur',
      'Transmission transporteur',
      'Réponse attendue',
      'Prochaine relance',
      'Réponse reçue',
      'Étape client',
      'Origine',
      'Transporteur',
      'Type ouverture',
      'Statut',
      'Agent',
      'Avoir généré',
      'Montant avoir',
      'Indemnisation',
      'Qualification clôture',
      'Motif clôture',
      'Ouverture',
      'Dernière clôture',
      'Réouvertures',
      'Délai total en jours',
    ];
    const rows = (Array.isArray(sourceRows) ? (sourceRows as Dossier[]) : filtered).map((x) => [
      x.ref,
      x.customer,
      x.customerAccount,
      x.order,
      x.amount,
      x.brand,
      x.store,
      x.productType,
      x.productRef,
      x.requester,
      x.ticket,
      x.bt,
      x.outcome,
      x.imputation,
      x.creditNumber,
      x.invoice,
      x.creditCreated,
      x.takenAt,
      x.disputeValue,
      x.rcCheck,
      x.rcManager,
      x.carrierStatus,
      x.solco,
      x.solution,
      x.compensationState,
      x.indemTps,
      x.followUp,
      x.carrierCaseRef,
      x.carrierSentAt,
      x.carrierResponseDue,
      x.carrierFollowupAt,
      x.carrierReplyAt,
      x.clientStage,
      x.origin,
      x.carrier,
      x.type,
      x.status,
      x.assignee,
      x.creditIssued ? 'Oui' : 'Non',
      x.credit,
      x.compensation,
      x.resolution?.verdict || '',
      x.resolution?.reason || '',
      x.created,
      x.closed || '',
      x.reopened.join(' | '),
      x.closed ? days(x.created, x.closed).toFixed(2) : '',
    ]);
    const cell = csvCell;
    const blob = new Blob(
        ['\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')],
        { type: 'text/csv;charset=utf-8;' },
      ),
      a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'optilitige-litiges.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    setNotice('Export téléchargé');
  }
  if (!booted)
    return (
      <div className="modal-overlay boot-screen">
        <section className="modal" aria-live="polite">
          <span className="eyebrow">OPTILITIGE</span>
          {error ? (
            <>
              <h2>Connexion impossible</h2>
              <p role="alert" className="error">
                {error}
              </p>
              <a className="primary" href={signInLink} target="_top">
                Se connecter avec Microsoft
              </a>
            </>
          ) : (
            <>
              <h2>Connexion à votre espace…</h2>
              <p>Vous allez être redirigé vers la connexion Microsoft si nécessaire.</p>
            </>
          )}
        </section>
      </div>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            nav('today');
          }}
        >
          <span className="brandicon">
            o<span>L</span>
          </span>
          OptiLitige<span className="brand-dot">.</span>
        </a>
        {/* Icône de l'onglet aux couleurs du thème choisi */}
        <ThemeFavicon />
        <div className="workspace group-workspace" title="Groupe Cybertek">
          <img src="/groupe-cybertek.png" alt="Groupe Cybertek" />
        </div>
        <div className="nav-label">ESPACE DE TRAVAIL</div>
        <nav>
          {
            // Menu selon le rôle : RC et SAV ont « Ma data » et la vue d'ensemble en bas ;
            // Analyses litiges pour Service Litige, Responsable et Admin ; Équipe & accès et
            // Contentieux pour les admins
            (
              (creatorView
                ? [
                    ['today', 'Ma journée', Sun],
                    ['dossiers', 'Dossiers litiges', FolderOpen],
                    ['my-data', 'Ma data', ChartNoAxesCombined],
                    ['overview', 'Vue d’ensemble', LayoutDashboard],
                  ]
                : [
                    ['today', 'Ma journée', Sun],
                    ['overview', 'Vue d’ensemble', LayoutDashboard],
                    ['dossiers', 'Dossiers litiges', FolderOpen],
                    ['credits', 'Avoirs à traiter', Receipt],
                    ['analytics', 'Analyses litiges', ChartNoAxesCombined],
                    ...(admin
                      ? [
                          ['team', 'Équipe & accès', Users],
                          ['contentieux', 'Contentieux', Scale],
                          ['contentieux-analytics', 'Analyses contentieux', ChartNoAxesCombined],
                        ]
                      : []),
                  ]) as [string, string, LucideIcon][]
            ).map(([key, label, Icon]) => (
              <button key={key} className={page === key ? 'active' : ''} onClick={() => nav(key)}>
                <Icon size={19} />
                {label}
                {key === 'dossiers' && <span className="nav-count">{active.length}</span>}
                {key === 'credits' && creditsToDo > 0 && (
                  <span className="nav-count">{creditsToDo}</span>
                )}
                {key === 'contentieux' && ctOpen > 0 && (
                  <span className={'nav-count' + (ctLate ? ' late' : '')}>{ctOpen}</span>
                )}
                {key === 'today' && myDay.total > 0 && (
                  <span className="nav-count">{myDay.total}</span>
                )}
              </button>
            ))
          }
        </nav>
        <div className="sidebar-bottom">
          <div className="help">
            <LifeBuoy size={20} />
            <strong>Un dossier, une solution.</strong>
            <p>
              Gardez le fil de chaque litige,
              <br />
              ensemble.
            </p>
            <button onClick={() => setModal('help')}>
              Guide de prise en main <ArrowUpRight size={14} />
            </button>
          </div>
          {/* Paramètres (types, SLA, avoirs, listes) : réservés aux admins */}
          {admin && (
            <button className="settings-link" onClick={() => nav('settings')}>
              <Settings size={18} />
              Paramètres
            </button>
          )}
          <div className="profile">
            <span className="avatar">{me.name[0]}</span>
            <div>
              <strong>{me.name}</strong>
              <small>
                {roleLabel(demo ? view : me.role)}
                {demo ? ' · démonstration' : ''}
              </small>
              {!demo && !!me.profiles?.length && (
                <button
                  type="button"
                  className="text-btn switch-profile"
                  onClick={() => chooseProfile('')}
                >
                  Changer de profil
                </button>
              )}
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      <style>{brandStyles}</style>
      {/* Espace réel : déconnexion après 2 heures sans action */}
      <IdleLogout enabled={!demo} signOutHref={data.signOut || '/auth/deconnexion'} />
      <ChartPrefsContext.Provider value={chartPrefs}>
        <main data-view={view}>
          <header className="topbar">
            <div className="breadcrumb">
              Espace de travail <ChevronRight size={13} />
              <strong>
                {r
                  ? 'Détail du dossier'
                  : (
                      {
                        today: 'Ma journée',
                        overview: 'Vue d’ensemble',
                        dossiers: 'Dossiers litiges',
                        analytics: 'Analyses litiges',
                        'my-data': 'Ma data',
                        credits: 'Avoirs à traiter',
                        team: 'Équipe & accès',
                        contentieux: 'Contentieux',
                        'contentieux-analytics': 'Analyses contentieux',
                        settings: 'Paramètres',
                      } as Record<string, string>
                    )[page]}
              </strong>
            </div>
            <div className="top-actions">
              <span className="live-dot" />
              <span className="top-date">
                {new Date().toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span className="divider" />
              <ThemeToggle />
              <button
                className="icon-btn"
                aria-label="Notifications"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                {totalUnread > 0 && <b className="notification-dot">{totalUnread}</b>}
              </button>
              {/* Agent connecté et son service (défini par un responsable dans Équipe & accès) */}
              <span className="top-user">
                <span className="avatar mini">{me.name[0]}</span>
                <span className="top-user-text">
                  <strong>{me.name}</strong>
                  <small>{roleLabel(demo ? view : me.role)}</small>
                </span>
              </span>
            </div>
            {notifications && (
              <div className="notifications">
                <strong>Notifications · {totalUnread} non lue(s)</strong>
                <div className="notification-tabs" role="tablist">
                  {ALERT_CATEGORIES.filter(
                    (c) => c.id !== 'assignments' || categoryAlerts.assignments.length > 0,
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="tab"
                      aria-selected={currentAlertTab === c.id}
                      className={currentAlertTab === c.id ? 'active' : ''}
                      onClick={() => setAlertTab(c.id)}
                    >
                      {c.label}
                      {alertCounts[c.id] > 0 && <span>{alertCounts[c.id]}</span>}
                    </button>
                  ))}
                </div>
                {currentAlertTab !== 'mentions' ? (
                  <AlertList
                    items={categoryAlerts[currentAlertTab] || []}
                    busy={busy}
                    empty={
                      currentAlertTab === 'assignments'
                        ? 'Aucun dossier ouvert ne vous est attribué.'
                        : currentAlertTab === 'rc'
                          ? 'Aucun dossier n’attend de réponse de votre part.'
                          : currentAlertTab === 'reminders'
                            ? 'Aucun rappel pour aujourd’hui. Dans un dossier : « Me rappeler le… ».'
                            : currentAlertTab === 'watch'
                              ? watching.length
                                ? 'Rien de nouveau sur les ' +
                                  watching.length +
                                  ' dossier(s) que vous suivez.'
                                : 'Vous ne suivez aucun dossier. Dans un dossier, cliquez sur « Suivre ce dossier » pour être prévenu de ses nouveautés.'
                              : currentAlertTab === 'credits'
                                ? 'Aucun avoir ne vous concerne pour le moment.'
                                : currentAlertTab === 'reports'
                                  ? 'Aucun rapport programmé ne vous est destiné. Les admins les créent dans Paramètres.'
                                  : 'Aucun dossier hors délai pour vous.'
                    }
                    onOpen={(record, item) => {
                      setNotifications(false);
                      if (item.reportId && item.period) {
                        const def = (data.reports || []).find((x) => x.id === item.reportId);
                        if (def)
                          setReportView({
                            title: def.name,
                            filters: def.filters,
                            kind: def.frequency,
                            periodKey: item.period.key,
                          });
                        return;
                      }
                      open(record);
                    }}
                    onRead={(keys: string[]) => action({ action: 'read-alert', keys })}
                  />
                ) : alerts.length ? (
                  alerts.map((a) => (
                    <article
                      key={a.key}
                      className={'notification-item ' + (a.unread ? 'is-unread' : '')}
                      data-notification-key={a.key}
                    >
                      <button
                        className="notification-open"
                        onClick={() => {
                          open(a.record);
                          setNotifications(false);
                        }}
                      >
                        <b>{a.author}</b> vous a mentionné dans {a.record.ref}
                        <small>{a.text}</small>
                        <small className="notification-group-count">
                          {a.mentionCount} mention{a.mentionCount > 1 ? 's' : ''}
                          {a.unread ? ' à traiter' : ' dans ce dossier'}
                        </small>
                      </button>
                      <div className="notification-item-footer">
                        <span
                          className={
                            a.unread ? 'notification-unread-label' : 'notification-read-label'
                          }
                        >
                          {a.unread ? 'Non lue' : 'Lue'}
                        </span>
                        {a.unread && (
                          <button
                            type="button"
                            className="notification-read-action"
                            disabled={busy}
                            onClick={() =>
                              action({
                                action: 'read-notification',
                                id: a.record.id,
                                commentIds: a.unreadIds,
                              })
                            }
                          >
                            <Check size={12} />
                            Marquer comme lue
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p>Aucune mention pour votre compte.</p>
                )}
                {currentAlertTab === 'mentions' && alerts.length > 0 && (
                  <p className="notification-rule">
                    Les mentions sont regroupées par dossier. Ouvrir le dossier ne le marque pas
                    comme lu : répondez ou utilisez « Marquer comme lue ».
                  </p>
                )}
              </div>
            )}
          </header>
          <div className="content">
            <div className="demo-bar">
              <span>
                <span className={demo ? 'demo-dot' : 'live-dot'} />
                <b>{demo ? 'Mode démonstration' : 'Espace réel'}</b>
                <span className="demo-desc">
                  {demo
                    ? 'Données fictives · essais enregistrés dans ce navigateur'
                    : 'Dossiers partagés et enregistrés dans la base de données'}
                </span>
              </span>
              {DEMO_ENABLED && (
                <button disabled={busy} onClick={switchMode}>
                  {demo ? 'Accéder à mon espace réel' : 'Revenir à la démonstration'}
                  <ArrowUpRight size={13} />
                </button>
              )}
            </div>
            {error && (
              <div role="alert" className="error">
                {error}
                <a href={signInLink} target="_top">
                  Se connecter
                </a>
                <button aria-label="Fermer" onClick={() => setError('')}>
                  <X size={16} />
                </button>
              </div>
            )}
            {!r && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">LA RELATION CLIENT, EN CONTINU</div>
                    <h1>
                      {
                        (
                          {
                            today: 'Votre journée, par ordre de priorité.',
                            overview: 'Chaque litige mérite une solution.',
                            dossiers: 'Vos dossiers, au même endroit.',
                            analytics: 'Les chiffres derrière les dossiers.',
                            'my-data': 'Vos chiffres, vos dossiers.',
                            credits: 'Chaque avoir, enregistré sans attendre.',
                            team: 'Une équipe, quatre services.',
                            contentieux: 'Chaque recours, dans les délais.',
                            'contentieux-analytics': 'Les chiffres derrière les contentieux.',
                            settings: 'Un espace à votre mesure.',
                          } as Record<string, string>
                        )[page]
                      }
                    </h1>
                    <p>
                      {
                        (
                          {
                            today:
                              'Rappels, délais, relances, avoirs et messages : tout ce qui vous attend aujourd’hui.',
                            overview:
                              'Suivez vos dossiers et faites avancer les résolutions, ensemble.',
                            dossiers: 'Retrouvez, priorisez et transmettez chaque litige.',
                            analytics:
                              'Dossiers litiges : mesurez les volumes, les délais et l’impact financier.',
                            'my-data':
                              'Les dossiers que vous avez créés : où ils en sont, leurs types, leurs enseignes et le délai jusqu’à la solution client.',
                            credits:
                              'Les demandes d’avoir en attente, tous dossiers confondus : saisissez les n° de l’ERP en une fois.',
                            'contentieux-analytics':
                              'Types, sujets, décisions, coûts et perte réelle des contentieux, mois par mois et d’une année sur l’autre.',
                            team: 'Associez chaque agent à son service et à ses responsabilités.',
                            contentieux:
                              'PayPal, opposition bancaire, médiation, recommandé, Signal Conso : délai légal, décision et coûts de chaque contentieux.',
                            settings: 'Adaptez la qualification des litiges à votre activité.',
                          } as Record<string, string>
                        )[page]
                      }
                    </p>
                  </div>
                  {['today', 'overview', 'dossiers'].includes(page) && canCreate && (
                    <button
                      className="primary"
                      onClick={() => {
                        setForm({
                          origin: 'Transport',
                          priority: 'Normale',
                          type: data.types[0],
                          brand: data.catalogs?.brands[0] || brands[0],
                          productType: 'PC',
                          disputeValue: '',
                          carrier: 'COLISSIMO',
                          // Demandeur : l'agent connecté par défaut (modifiable)
                          requester: me.name,
                          requesterEmail: me.email,
                        });
                        setNewFiles([]);
                        setModal('new');
                      }}
                    >
                      <Plus size={17} />
                      Nouveau litige
                    </button>
                  )}
                </div>
                {/* Choix du service : uniquement en démonstration, pour tester chaque rôle.
                  Dans l'espace réel, le service vient du compte (Équipe & accès) et s'affiche
                  à côté du nom de l'agent, en haut à droite. */}
                {demo && ['today', 'overview', 'dossiers', 'my-data'].includes(page) && (
                  <div className="view-row">
                    <div className="view-tabs">
                      {roles.map((role) => (
                        <button
                          key={role}
                          className={view === role ? 'active' : ''}
                          onClick={() => selectDemoRole(role)}
                        >
                          {roleIcon(role, 15)} {roleLabel(role)}
                        </button>
                      ))}
                    </div>
                    <span className="view-caption">
                      Démonstration : choisissez un service pour tester ses écrans
                    </span>
                  </div>
                )}
              </>
            )}
            {r ? (
              <>
                <button
                  className="back"
                  onClick={() => {
                    setReturnTo(r.id);
                    setSelected(null);
                  }}
                >
                  <ArrowLeft size={16} />
                  Retour aux dossiers
                </button>
                {lateOf(r).length > 0 && (
                  <div role="status" className="late-banner">
                    <b>Hors délai</b>
                    <ul>
                      {lateOf(r).map((l) => (
                        <li key={l.rule.id}>
                          {l.rule.label} : délai de {formatHours(l.rule.hours)} dépassé de{' '}
                          {formatHours(l.overdueHours)} (depuis le {dateTime(l.since)})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {staleDetail && (
                  <div role="status" className="stale-banner">
                    Un collègue a modifié ce dossier depuis que vous l’avez ouvert.
                    <button disabled={busy} onClick={() => open(listed)}>
                      Recharger le dossier
                    </button>
                  </div>
                )}
                <div className="detail-heading">
                  <div>
                    <span className="eyebrow">
                      {r.ref} · {r.origin}
                    </span>
                    <h1>{r.title}</h1>
                    {(() => {
                      const p = participants(r, data.members);
                      return (
                        <p className="participants">
                          {p.owner && (
                            <span className="owner">
                              Propriétaire : <b>{p.owner.name}</b>
                              {p.owner.role ? ' (' + roleLabel(p.owner.role) + ')' : ''}
                            </span>
                          )}
                          {p.others.length > 0 && (
                            <span>
                              Intervenants :{' '}
                              {p.others.map((o, i: number) => (
                                <span
                                  key={o.key}
                                  className="participant"
                                  title={
                                    o.actions.length ? 'A participé : ' + o.actions.join(', ') : ''
                                  }
                                >
                                  {i ? ', ' : ''}
                                  {o.name}
                                  {o.role ? ' (' + roleLabel(o.role) + ')' : ''}
                                </span>
                              ))}
                            </span>
                          )}
                        </p>
                      );
                    })()}
                    <p>
                      Ouvert le {date(r.created)} · Commande {r.order}
                      {importInfo(r) && (
                        <>
                          {' · '}Importé le {dateTime(importInfo(r)!.date)}
                          {importInfo(r)!.file ? ' depuis ' + importInfo(r)!.file : ''}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="detail-heading-actions">
                    {/* Aide masquée : onglet accroché au bord droit, qui suit le défilement */}
                    {!guideOpen && (
                      <button
                        type="button"
                        className="help-dock"
                        onClick={() => {
                          setGuideSlide(true);
                          setHelpOpen(GUIDE_HELP, true);
                          window.setTimeout(() => setGuideSlide(false), 600);
                        }}
                        title="Ouvrir l’aide « Qui fait quoi, et quand »"
                      >
                        <CircleHelp size={17} />
                        <span>Ouvrir l’aide</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={'secondary watch-btn' + (watching.includes(r.id) ? ' on' : '')}
                      aria-pressed={watching.includes(r.id)}
                      disabled={busy}
                      title={
                        watching.includes(r.id)
                          ? 'Ne plus recevoir les nouveautés de ce dossier'
                          : 'Recevoir une notification à chaque modification ou message sur ce dossier'
                      }
                      onClick={() =>
                        action({
                          action: 'watch',
                          id: r.id,
                          on: !watching.includes(r.id),
                        } as ActionPayload)
                      }
                    >
                      {watching.includes(r.id) ? <BellRing size={15} /> : <Bell size={15} />}
                      {watching.includes(r.id) ? 'Suivi' : 'Suivre ce dossier'}
                    </button>
                    <button
                      type="button"
                      className="secondary print-btn"
                      title="Ouvre l’impression : choisissez « Enregistrer au format PDF »"
                      onClick={() => window.print()}
                    >
                      <Printer size={15} /> Fiche PDF
                    </button>
                    {admin && (
                      <button
                        type="button"
                        className="secondary danger delete-record-btn"
                        disabled={busy}
                        title="Supprimer ce dossier (réservé aux admins)"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Supprimer le dossier ' +
                                r.ref +
                                ' « ' +
                                r.title +
                                ' » ?\n\nIl disparaîtra de la liste pour tout le monde. Une copie et ses pièces jointes sont gardées de côté : en cas d’erreur, il peut être récupéré.',
                            )
                          )
                            action({ action: 'record-delete', id: r.id } as ActionPayload);
                        }}
                      >
                        <Trash2 size={15} /> Supprimer
                      </button>
                    )}
                    <Badge status={r.status} />
                  </div>
                </div>
                <PrintSheet record={r} members={data.members} me={me} />
                <RepeatCustomerBanner
                  customer={r.customer}
                  info={repeatInfo(customers, r, repeatAlerts)}
                  onOpen={(x) => open(x)}
                />
                <ReminderBox
                  key={'rappels-' + r.id}
                  reminders={reminders.filter((x) => x.recordId === r.id)}
                  busy={busy}
                  onAdd={(date, note) =>
                    action({ action: 'reminder-add', id: r.id, date, note } as ActionPayload)
                  }
                  onDelete={(reminderId) =>
                    action({ action: 'reminder-delete', reminderId } as ActionPayload)
                  }
                />
                <ParcelTimeline
                  key={r.id}
                  record={r}
                  links={data.trackingLinks || DEFAULT_TRACKING_LINKS}
                  demo={demo}
                  admin={admin}
                />
                <div className={'detail-grid' + (guideOpen ? '' : ' no-guide')}>
                  <section className="panel detail-info">
                    <div className="panel-heading">
                      <h2>Informations du dossier</h2>
                      <span className="panel-heading-actions">
                        <span className={'priority ' + (r.priority === 'Haute' ? 'high' : '')}>
                          Priorité {(r.priority || 'Normale').toLowerCase()}
                        </span>
                        {/* Correction des informations (montant, commande…) : responsables */}
                        {admin && (
                          <button
                            type="button"
                            className="secondary small-btn"
                            onClick={() => setModal('edit-info')}
                          >
                            <Pencil size={14} /> Modifier
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="info-grid">
                      {(
                        [
                          ['Enseigne', <BrandName key="brand" brand={r.brand} store={r.store} />],
                          ['Type de produit', r.productType || 'Non renseigné'],
                          ['Référence produit', r.productRef || '—'],
                          ['Ticket / BT', [r.ticket, r.bt].filter(Boolean).join(' / ') || '—'],
                          ['Résultat du litige', r.outcome || '—'],
                          ['Imputation', r.imputation || '—'],
                          ['Prise en charge', date(r.takenAt)],
                          ['Demandeur', r.requester || r.creator],
                          [
                            'Propriétaire du dossier',
                            participants(r, data.members).owner?.name || '—',
                          ],
                          ['Compte client', r.customerAccount || '—'],
                          ['Client', r.customer],
                          ['Commande', r.order],
                          // Seul le montant concerné par le litige s'affiche (toute la commande
                          // ou une partie) ; le montant de commande repris reste dans l'export
                          ['Montant concerné par le litige', money(stakeOf(r))],
                          ['Type à l’ouverture', r.type],
                          ['Transporteur', r.carrier || '—'],
                          ['Origine', r.origin],
                          ['Clôture', date(r.closed)],
                          ['Réouverture(s)', r.reopened.map(date).join(', ') || '—'],
                        ] as [string, ReactNode][]
                      ).map(([label, value]) => (
                        <div key={label}>
                          <small>{label}</small>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                    {/* Contentieux du client sur cette commande : responsables seulement */}
                    {admin && (
                      <DossierContentieux
                        record={r}
                        list={data.contentieux || []}
                        busy={busy}
                        onOpen={(focus) => {
                          nav('contentieux');
                          setCtFocus(focus);
                        }}
                        onLink={(c, accept) =>
                          action({
                            action: accept ? 'contentieux-link' : 'contentieux-decline',
                            id: c.id,
                            version: c.version,
                            dossierId: r.id,
                          } as ActionPayload)
                        }
                      />
                    )}
                    {r.carrierStatus && (
                      <div className={'carrier-summary ' + (overdueCarrier(r) ? 'overdue' : '')}>
                        <Truck size={18} />
                        <div>
                          <b>
                            {r.carrierStatus}
                            {overdueCarrier(r) ? ' · Relance à effectuer' : ''}
                          </b>
                          <p>
                            {r.carrierCaseRef ? 'Réf. ' + r.carrierCaseRef + ' · ' : ''}Prochaine
                            relance : {date(r.carrierFollowupAt)} · Réponse attendue :{' '}
                            {date(r.carrierResponseDue)}
                          </p>
                          <p>Client : {r.clientStage || 'À préciser'}</p>
                          <button className="text-btn" onClick={() => setModal('client')}>
                            Mettre à jour le suivi client →
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="description">
                      <small>Description du signalement</small>
                      <p>{r.description}</p>
                    </div>
                    {r.resolution && (
                      <div className="resolution">
                        <CheckCheck size={18} />
                        <div>
                          <b>Dernière résolution : {r.resolution.verdict}</b>
                          <p>{r.resolution.reason}</p>
                        </div>
                      </div>
                    )}
                    {r.sourceData && (
                      <details className="source-data">
                        <summary>Données source Microsoft Lists · {r.sourceList}</summary>
                        {Object.entries(r.sourceData).map(([k, v]) => (
                          <div key={k}>
                            <b>{k}</b>
                            <span>{String(v ?? '')}</span>
                          </div>
                        ))}
                      </details>
                    )}
                    <div className="detail-tabs">
                      {['Échanges', 'Avoirs', 'Pièces jointes', 'Transporteur', 'Historique'].map(
                        (t) => (
                          <button
                            className={tab === t ? 'active' : ''}
                            key={t}
                            onClick={() => setTab(t)}
                          >
                            {t}
                            {t === 'Échanges' ? ' (' + r.comments.length + ')' : ''}
                            {t === 'Pièces jointes'
                              ? ' (' + (r.attachments || []).length + ')'
                              : ''}
                            {t === 'Avoirs' && (r.credits || []).length
                              ? ' (' + (r.credits || []).length + ')'
                              : ''}
                          </button>
                        ),
                      )}
                    </div>
                    {tab === 'Échanges' ? (
                      <>
                        <HelpTip id="echanges" title="Échanges">
                          <p>
                            Tapez @ puis un nom pour prévenir un collègue (il reçoit une
                            notification). Les messages des collègues apparaissent ici en direct.
                            Pour être prévenu de tout ce qui se passe sur ce dossier : « Suivre ce
                            dossier » en haut.
                          </p>
                        </HelpTip>
                        <div className="comments">
                          {r.comments.length ? (
                            r.comments.map((c) => (
                              <article
                                key={c.id}
                                className={
                                  'comment' + (arrived.includes(c.id) ? ' just-arrived' : '')
                                }
                              >
                                <span className="avatar">{c.author[0]}</span>
                                <div>
                                  <b>{c.author}</b>
                                  <time>Le {dateTime(c.date)}</time>
                                  <p>{c.text}</p>
                                  {(c.mentions?.length as number) > 0 && (
                                    <small className="mention">
                                      {c
                                        .mentions!.map(
                                          (email: string) =>
                                            '@' +
                                            (data.members.find((m) => m.email === email)?.name ||
                                              email),
                                        )
                                        .join(' ')}
                                    </small>
                                  )}
                                </div>
                              </article>
                            ))
                          ) : (
                            <p className="muted">
                              Aucun échange. Ajoutez une première note au dossier.
                            </p>
                          )}
                        </div>
                        <CommentComposer
                          key={r.id}
                          members={data.members}
                          busy={busy}
                          onSubmit={(text, mentions) =>
                            action({
                              action: 'comment',
                              id: r.id,
                              version: r.version,
                              text,
                              mentions,
                            })
                          }
                        />
                      </>
                    ) : tab === 'Avoirs' ? (
                      <>
                        <HelpTip id="avoirs" title="Avoirs">
                          <p>
                            Le Service Litige demande l’avoir ici (motif, montant, imputation), fait
                            l’avoir dans l’ERP, puis saisit son numéro et valide : l’avoir est émis.
                            Les demandes en attente sont aussi regroupées dans « Avoirs à traiter ».
                            La RC et le SAV consultent les avoirs sans pouvoir les modifier.
                          </p>
                        </HelpTip>
                        <CreditPanel
                          key={r.id}
                          record={r}
                          member={{ ...me, role: demo ? view : me.role }}
                          settings={creditSettings}
                          busy={busy}
                          onAction={(payload) => action({ ...payload, id: r.id })}
                        />
                      </>
                    ) : tab === 'Pièces jointes' ? (
                      <>
                        <HelpTip id="pieces-jointes" title="Pièces jointes">
                          <p>
                            Ajoutez photos, bons de livraison, preuves de dépôt ou e-mails
                            (glisser-déposer, ou appareil photo sur téléphone). Ils sont visibles de
                            tous les services et suivent le dossier.
                          </p>
                        </HelpTip>
                        <Attachments
                          key={r.id}
                          record={r}
                          member={me}
                          demo={demo}
                          onChanged={async (message: string) => {
                            setError('');
                            try {
                              await fetchDetail(r.id);
                              await load(true);
                              setNotice(message);
                            } catch (e) {
                              setError(e instanceof Error ? e.message : String(e));
                            }
                          }}
                        />
                      </>
                    ) : tab === 'Transporteur' ? (
                      <>
                        <HelpTip id="transporteur" title="Transporteur">
                          <p>
                            En haut, le formulaire de réclamation du transporteur, pré-rempli avec
                            ce dossier : l’envoi direct arrivera avec son API ; en attendant, ouvrez
                            le formulaire en ligne et collez-y le résumé. En bas, les e-mails aux
                            commerciaux du transporteur, quand le service client tarde : choisissez
                            un modèle, ouvrez l’e-mail dans votre messagerie, consignez-le, puis
                            notez la date de transmission dans le traitement : les relances se
                            programment seules.
                          </p>
                        </HelpTip>
                        <CarrierPlatform
                          record={r}
                          canEdit={canEdit}
                          forms={data.claimForms || {}}
                        />
                        <h3 className="transport-section-title">
                          E-mails aux commerciaux du transporteur
                        </h3>
                        <TransportConversation
                          key={
                            'echanges-' +
                            r.id +
                            ':' +
                            JSON.stringify(data.claimTemplates || []).length
                          }
                          record={r}
                          me={me}
                          templates={data.claimTemplates || DEFAULT_CLAIM_TEMPLATES}
                          signatures={data.mailSignatures || DEFAULT_SIGNATURES}
                          onSaveTemplates={(templates) =>
                            action({ action: 'claim-templates', templates } as ActionPayload)
                          }
                          mailbox={data.mailbox || mailbox}
                          connected={false}
                          canEdit={canEdit}
                          busy={busy}
                          onSave={(message) =>
                            action({ action: 'transport', id: r.id, version: r.version, message })
                          }
                        />
                      </>
                    ) : (
                      <div className="timeline">
                        {[...(r.history || [])].reverse().map((h, i: number) => (
                          <div key={i}>
                            <span />
                            <div>
                              <b>{h.text}</b>
                              <p>
                                {/* Les lignes « Migration » reprennent des dates sans heure */}
                                {h.author} · le{' '}
                                {h.author === 'Migration' ? date(h.date) : dateTime(h.date)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className="panel treatment">
                    <div className="panel-heading">
                      <h2>Traitement du litige</h2>
                      <FolderOpen size={17} />
                    </div>
                    <div
                      className={'treatment-access ' + (!canEdit ? 'read-only' : '')}
                      role="note"
                    >
                      <strong>
                        {demo
                          ? 'Démonstration · vue ' + roleLabel(view)
                          : 'Service de votre compte : ' + me.role}
                      </strong>
                      <p>
                        {canEdit
                          ? 'Vous pouvez modifier et enregistrer le traitement de ce dossier.'
                          : demo
                            ? 'La vue Relation client consulte le traitement. Choisissez Service Litige, Responsable ou Admin ci-dessous pour tester les modifications.'
                            : 'Le traitement et les montants sont réservés au Service Litige, aux Responsables et aux Admins. Vous pouvez compléter le suivi client et les commentaires.'}
                      </p>
                      {demo && (
                        <div
                          className="detail-role-switcher"
                          role="group"
                          aria-label="Choisir la vue de démonstration"
                        >
                          {roles.map((role) => (
                            <button
                              type="button"
                              key={role}
                              aria-pressed={view === role}
                              className={view === role ? 'active' : ''}
                              onClick={() => selectDemoRole(role)}
                            >
                              {roleLabel(role)}
                            </button>
                          ))}
                        </div>
                      )}
                      {!canEdit && (
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => setModal('client')}
                        >
                          Compléter le suivi client →
                        </button>
                      )}
                    </div>
                    <PrefillBanner
                      record={r}
                      canEdit={canEdit}
                      busy={busy}
                      // La révision du formulaire est recalée par action() (pas de faux conflit)
                      onConfirm={() => action({ action: 'prefill-ok', id: r.id } as ActionPayload)}
                    />
                    {canEdit &&
                      ['Pris en charge', 'En attente RC', 'Réouvert'].includes(r.status) && (
                        <div className="close-bar">
                          <button
                            type="button"
                            className="primary"
                            disabled={busy}
                            onClick={() => setModal('close')}
                          >
                            <CheckCircle2 size={16} /> Clôturer le dossier
                          </button>
                          <small>Résultat et imputation, puis le dossier passe « Résolu ».</small>
                        </div>
                      )}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const dates = Object.fromEntries(
                          [
                            'carrierSentAt',
                            'carrierResponseDue',
                            'carrierFollowupAt',
                            'carrierReplyAt',
                            'creditCreated',
                          ].map((k) => [k, fd.get(k) || null]),
                        );
                        const goNext =
                          (e.nativeEvent as SubmitEvent).submitter?.getAttribute('name') === 'next';
                        const next = goNext ? nextInList(r.id) : undefined;
                        const ok = await saveTreatment(r, {
                          ...edit,
                          ...dates,
                          creditNumber:
                            (fd.get('creditNumber') as string | null) ?? edit.creditNumber,
                          credit: (fd.get('credit') as string | null) ?? edit.credit,
                        });
                        // « Enregistrer et dossier suivant » : on ouvre directement le suivant
                        if (ok && goNext && next) openFromList(next);
                      }}
                    >
                      <h3 className="first-step">1. Statut et prise en charge</h3>
                      <SectionHint
                        who={['Service Litige']}
                        when="Dès l’arrivée du dossier (sous 24 h), puis à chaque changement d’étape"
                      />
                      <label>
                        Statut du dossier
                        <select
                          value={edit.status}
                          onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                        >
                          {statuses
                            .filter(
                              (s) =>
                                s === r.status ||
                                (
                                  {
                                    Nouveau: ['Pris en charge'],
                                    'Pris en charge': ['En attente RC', 'Résolu'],
                                    'En attente RC': ['Pris en charge', 'Résolu'],
                                    Résolu: ['Réouvert'],
                                    Réouvert: ['Pris en charge', 'En attente RC', 'Résolu'],
                                  } as Record<string, string[]>
                                )[r.status].includes(s),
                            )
                            .filter(
                              (s) =>
                                canEdit ||
                                s === r.status ||
                                s === 'Réouvert' ||
                                (r.status === 'En attente RC' && s === 'Pris en charge'),
                            )
                            .map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Suivi par (facultatif)
                        <select
                          disabled={!canEdit}
                          value={edit.assignee}
                          onChange={(e) => setEdit({ ...edit, assignee: e.target.value })}
                        >
                          <option value="">Toute l’équipe</option>
                          {data.members
                            .filter((m) => treatsDisputes(m.role))
                            .map((m) => (
                              <option key={m.email} value={m.email}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div
                        className={
                          'carrier-block' +
                          (edit.carrierDecision === NOT_CARRIER ? ' not-concerned' : '')
                        }
                      >
                        <h3>2. Réclamation au transporteur</h3>
                        <SectionHint
                          who={['Service Litige']}
                          when="Juste après la prise en charge (litiges transport), puis à chaque relance"
                        />
                        {edit.carrierDecision === NOT_CARRIER && (
                          <p className="not-concerned-note">
                            Ne concerne pas le transporteur : rien à réclamer ni à relancer
                            (décision en partie 3).
                          </p>
                        )}
                        <label>
                          État du dossier transporteur
                          <select
                            disabled={!canEdit}
                            value={edit.carrierStatus || 'À transmettre'}
                            onChange={(e) => setEdit({ ...edit, carrierStatus: e.target.value })}
                          >
                            {!carrierStages.includes(edit.carrierStatus as string) &&
                              edit.carrierStatus && <option>{edit.carrierStatus}</option>}
                            {carrierStages.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Référence de réclamation transporteur
                          <input
                            disabled={!canEdit}
                            value={edit.carrierCaseRef}
                            onChange={(e) => setEdit({ ...edit, carrierCaseRef: e.target.value })}
                          />
                        </label>
                        <label>
                          Montant concerné par le litige (€)
                          <input
                            disabled={!canEdit}
                            type="number"
                            min="0"
                            step="0.01"
                            value={edit.disputeValue}
                            onChange={(e) => setEdit({ ...edit, disputeValue: e.target.value })}
                          />
                        </label>
                        <label>
                          Transmission au transporteur
                          <input
                            name="carrierSentAt"
                            disabled={!canEdit}
                            type="date"
                            value={edit.carrierSentAt?.slice(0, 10) || ''}
                            onChange={(e) =>
                              // Relance et réponse attendue calculées seules (modifiables ensuite)
                              setEdit({
                                ...edit,
                                ...autoCarrierDates(edit, e.target.value, carrierDelays),
                              })
                            }
                          />
                        </label>
                        <label>
                          Prochaine relance
                          <span className="input-with-action">
                            <input
                              name="carrierFollowupAt"
                              disabled={!canEdit}
                              type="date"
                              value={edit.carrierFollowupAt?.slice(0, 10) || ''}
                              onChange={(e) =>
                                setEdit({ ...edit, carrierFollowupAt: e.target.value })
                              }
                            />
                            {canEdit && r.carrierSentAt && !r.carrierReplyAt && (
                              <button
                                type="button"
                                className="secondary small-btn"
                                disabled={busy}
                                title={
                                  'Note la relance et repousse la prochaine de ' +
                                  carrierDelays.followupDays +
                                  ' jours'
                                }
                                onClick={() => followupDone(r)}
                              >
                                <Check size={13} /> Relance faite
                              </button>
                            )}
                          </span>
                          <small className="field-note">
                            Calculée seule : transmission + {carrierDelays.followupDays} jours, puis
                            + {carrierDelays.followupDays} jours à chaque « Relance faite ».
                            Modifiable.
                          </small>
                        </label>
                        <label>
                          Réponse attendue le
                          <input
                            name="carrierResponseDue"
                            disabled={!canEdit}
                            type="date"
                            value={edit.carrierResponseDue?.slice(0, 10) || ''}
                            onChange={(e) =>
                              setEdit({ ...edit, carrierResponseDue: e.target.value })
                            }
                          />
                          <small className="field-note">
                            Calculée seule : transmission + {carrierDelays.responseDays} jours.
                            Modifiable.
                          </small>
                        </label>
                      </div>
                      <div className="form-divider" />
                      <h3>3. Réponse du transporteur</h3>
                      <SectionHint
                        who={['Service Litige']}
                        when="À réception de la réponse du transporteur"
                      />
                      <label hidden={edit.carrierDecision === NOT_CARRIER}>
                        Réponse reçue le
                        <input
                          name="carrierReplyAt"
                          disabled={!canEdit}
                          type="date"
                          value={edit.carrierReplyAt?.slice(0, 10) || ''}
                          onChange={(e) => setEdit({ ...edit, carrierReplyAt: e.target.value })}
                        />
                      </label>
                      {/* Issue de la réclamation : alimente les ratios acceptés / refusés */}
                      <label>
                        Décision du transporteur
                        <select
                          disabled={!canEdit}
                          value={edit.carrierDecision || ''}
                          onChange={(e) => setTreat({ carrierDecision: e.target.value })}
                        >
                          <option value="">En attente de décision</option>
                          {CARRIER_DECISIONS.map((d: string) => (
                            <option key={d} value={d}>
                              {d === 'Partiel' ? 'Accepté en partie' : d}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label hidden={edit.carrierDecision === NOT_CARRIER}>
                        Indemnisation transporteur reçue (€)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required={edit.carrierDecision !== NOT_CARRIER}
                          disabled={!canEdit}
                          value={edit.compensation}
                          onChange={(e) => setEdit({ ...edit, compensation: e.target.value })}
                        />
                      </label>
                      {/* Écart et avoir anticipé, calculés sur les valeurs saisies */}
                      {(() => {
                        const preview = { ...r, ...edit } as Dossier;
                        const gap = indemnityGap(preview);
                        const anticipated = isAnticipatedCredit(preview);
                        const internal = noCarrierClaim.includes(String(preview.imputation));
                        if (gap === null && !anticipated && !internal) return null;
                        return (
                          <div className="gap-line">
                            {internal && (
                              <span className="gap-internal">
                                Imputation {String(preview.imputation).toLowerCase()} (partie 5) :
                                pas d’écart d’indemnisation, rien à réclamer au transporteur
                              </span>
                            )}
                            {gap !== null && (
                              <span className={gap > 0 ? 'gap-open' : 'gap-closed'}>
                                Écart d’indemnisation : <b>{money(gap)}</b>
                              </span>
                            )}
                            {anticipated && (
                              <span
                                className="anticipated-badge"
                                title="Avoir émis avant la réponse du transporteur"
                              >
                                Avoir anticipé
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <div className="form-divider" />
                      <h3>4. Solution pour le client</h3>
                      <SectionHint
                        who={['Service Litige', 'RC', 'SAV']}
                        when="Dès que la solution est décidée ; la RC et le SAV la complètent avec « Compléter le suivi client »"
                      />
                      <label>
                        Étape côté client
                        <select
                          disabled={!canEdit}
                          value={edit.clientStage}
                          onChange={(e) => setEdit({ ...edit, clientStage: e.target.value })}
                        >
                          {!clientStages.includes(edit.clientStage as string) &&
                            edit.clientStage && <option>{edit.clientStage}</option>}
                          {clientStages.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      {/* Avoirs : le circuit est dans l'onglet Avoirs (demande, validation, émission avec son
                          numéro) ; ici un résumé. La saisie directe reste pour les anciens dossiers
                          repris de SharePoint qui ont déjà un avoir noté ici. */}
                      {(r.creditNumber || r.creditIssued) &&
                      !(r.credits || []).some((c) => c.status === 'issued') ? (
                        <>
                          <label>
                            Numéro d’avoir
                            <input
                              name="creditNumber"
                              maxLength={200}
                              disabled={!canEdit}
                              value={edit.creditNumber}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEdit((previous) => ({
                                  ...previous,
                                  creditNumber: value,
                                  creditCreated: value.trim()
                                    ? previous.creditCreated || r.creditCreated || creditToday()
                                    : '',
                                }));
                              }}
                            />
                          </label>
                          {!!edit.creditNumber!.trim() && (
                            <label>
                              Montant de l’avoir (€)
                              <input
                                name="credit"
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                disabled={!canEdit}
                                value={edit.credit}
                                onChange={(e) => setEdit({ ...edit, credit: e.target.value })}
                              />
                            </label>
                          )}
                          {!edit.creditNumber!.trim() && r.creditIssued && !r.creditNumber && (
                            <p className="legacy-credit-note">
                              Un avoir historique de {money(r.credit)} est déjà renseigné sans
                              numéro. Il sera conservé ; complétez le numéro pour modifier ses
                              informations.
                            </p>
                          )}
                          <label>
                            Date d’émission de l’avoir
                            <input
                              name="creditCreated"
                              disabled={!canEdit || !edit.creditNumber!.trim()}
                              required={!!edit.creditNumber!.trim()}
                              type="date"
                              value={edit.creditCreated?.slice(0, 10) || ''}
                              onChange={(e) => setEdit({ ...edit, creditCreated: e.target.value })}
                            />
                          </label>
                        </>
                      ) : (
                        <div className="credit-summary-block">
                          <span className="field-label">Avoirs du dossier</span>
                          {(r.credits || []).length ? (
                            <ul className="credit-summary">
                              {(r.credits || []).map((c) => (
                                <li key={c.id}>
                                  <b>{money(c.approvedAmount ?? c.amount)}</b>
                                  <span>{CREDIT_KINDS[c.kind] || c.kind}</span>
                                  <span>{CREDIT_STATUSES[c.status] || c.status}</span>
                                  {c.issue?.number && <span>n° {c.issue.number}</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="field-note">Aucun avoir pour ce dossier.</p>
                          )}
                          <button
                            type="button"
                            className="text-btn"
                            onClick={() => setTab('Avoirs')}
                          >
                            Ouvrir l’onglet Avoirs →
                          </button>
                        </div>
                      )}
                      <label>
                        Numéro de facture
                        <input
                          disabled={!canEdit}
                          value={edit.invoice}
                          onChange={(e) => setEdit({ ...edit, invoice: e.target.value })}
                        />
                      </label>
                      <small>
                        Avoir : demandé par la RC ou le SAV, validé puis émis dans l’ERP par le
                        Service Litige, avec son numéro, dans l’onglet Avoirs. Aucun avoir comptable
                        n’est émis depuis cette application.
                      </small>
                      <div className="form-divider" />
                      <h3>5. Clôture</h3>
                      <SectionHint
                        who={['Service Litige']}
                        when="Quand le client a sa solution : « Clôturer le dossier » en haut du traitement (ou statut « Résolu » en partie 1)"
                      />
                      <label>
                        Résultat du litige
                        <select
                          disabled={!canEdit}
                          // Obligatoire au passage en « Résolu » ; un ancien dossier résolu reste
                          // modifiable sans qualifier le résultat
                          required={edit.status === 'Résolu' && r.status !== 'Résolu'}
                          value={edit.outcome}
                          onChange={(e) => setTreat({ outcome: e.target.value })}
                        >
                          <option value="">À qualifier</option>
                          {(data.catalogs?.outcomes || outcomes).map((s: string) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Imputation
                        <select
                          disabled={!canEdit}
                          required={edit.status === 'Résolu' && r.status !== 'Résolu'}
                          value={edit.imputation}
                          onChange={(e) => setTreat({ imputation: e.target.value })}
                        >
                          <option value="">À préciser</option>
                          {imputations.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <small className="field-note">
                          Interne : erreur ou faute de notre côté · Transporteur : à la charge du
                          transporteur · Autre : un tiers (point relais qui renvoie le colis trop
                          tôt…)
                        </small>
                      </label>
                      {/* Plus de « Qualification à la résolution » : la conclusion (avéré / non avéré)
                          est déduite du résultat du litige (app/treatment-rules.mjs) */}
                      {edit.status === 'Réouvert' && r.status === 'Résolu' && (
                        <label>
                          Motif de réouverture
                          <textarea
                            required
                            value={edit.reopenReason}
                            onChange={(e) => setEdit({ ...edit, reopenReason: e.target.value })}
                          />
                        </label>
                      )}
                      {/* Anciens champs de la liste SharePoint (Check RC, Solco, Indem tps…) : plus
                          affichés ; leurs valeurs restent dans le dossier, l'export et « Données
                          source », et sont renvoyées telles quelles à l'enregistrement */}
                      <div className="save-bar">
                        <button
                          className="primary"
                          disabled={busy || (!canEdit && edit.status === r.status)}
                        >
                          <Check size={16} />
                          Enregistrer le traitement
                        </button>
                        {canEdit && nextInList(r.id) && (
                          <button
                            name="next"
                            className="secondary"
                            disabled={busy}
                            title="Enregistre ce dossier puis ouvre le suivant de la liste"
                          >
                            Enregistrer et dossier suivant <ChevronRight size={15} />
                          </button>
                        )}
                      </div>
                    </form>
                    <div className="delay">
                      <Clock size={19} />
                      <div>
                        <b>{days(r.created, r.closed).toFixed(1)} jours</b>
                        <small>
                          {r.closed ? 'Délai ouverture → clôture' : 'Depuis l’ouverture du dossier'}
                        </small>
                      </div>
                    </div>
                  </section>
                  {/* Qui fait quoi, et quand : à droite, reste visible en faisant défiler */}
                  {guideOpen && (
                    <aside
                      className={'detail-guide' + (guideSlide ? ' slide-in' : '')}
                      aria-label="Qui fait quoi, et quand"
                    >
                      <TreatmentGuide record={r} role={demo ? view : me.role} />
                    </aside>
                  )}
                </div>
              </>
            ) : (
              <>
                {page === 'today' && (
                  <>
                    <HelpTip id="ma-journee" title="Ma journée">
                      <p>
                        Tout ce que vous avez à faire aujourd’hui, du plus urgent au moins urgent :
                        rappels, dossiers hors délai ou bientôt hors délai, prises en charge,
                        relances transporteur, avoirs, réponses attendues et messages. Chaque ligne
                        a son bouton pour agir ; elle disparaît d’elle-même quand c’est fait.
                      </p>
                    </HelpTip>
                    <MyDay
                      name={me.name}
                      sections={myDay.sections as DaySection[]}
                      total={myDay.total}
                      busy={busy}
                      canEdit={canEdit}
                      onOpen={async (x, t) => {
                        await open(x);
                        if (t) setTab(t);
                      }}
                      onDone={(reminderId) =>
                        action({ action: 'reminder-delete', reminderId } as ActionPayload)
                      }
                      onRead={(keys) => action({ action: 'read-alert', keys })}
                      onReadMention={(m) =>
                        action({
                          action: 'read-notification',
                          id: m.record.id,
                          commentIds: m.unreadIds,
                        })
                      }
                      onFollowupDone={(x) => followupDone(x)}
                      onTake={async (x) => {
                        await bulkRun('assign', me.email, [x.id]);
                        await bulkRun('status', 'Pris en charge', [x.id]);
                      }}
                    />
                  </>
                )}
                {['overview', 'dossiers'].includes(page) && (
                  <>
                    <div className="role-banner">
                      <div>
                        <h3>
                          {creatorView
                            ? 'Votre tableau de bord relation client'
                            : litigeView
                              ? 'Votre tableau de bord service litige'
                              : 'Votre tableau de bord admin'}
                        </h3>
                        <p>
                          {creatorView
                            ? records.filter((x) => x.status === 'En attente RC').length +
                              ' dossiers attendent une réponse RC · ' +
                              records.filter((x) => x.creator === me.email && x.status !== 'Résolu')
                                .length +
                              ' de vos signalements restent ouverts'
                            : litigeView
                              ? records.filter((x) => x.status === 'Nouveau').length +
                                ' nouveaux dossiers à prendre en charge · ' +
                                records.filter((x) => openCredits(x).length > 0).length +
                                ' dossier(s) avec un avoir à traiter'
                              : money(sum('compensation')) +
                                ' indemnisés par les transporteurs · ' +
                                records.filter((x) => x.reopened.length).length +
                                ' dossiers réouverts au moins une fois'}
                        </p>
                        <p>
                          {records.filter(overdueCarrier).length} relance(s) transporteur à
                          effectuer · {records.filter(waitingCarrier).length} dossier(s) en attente
                          transporteur · {lateCount} dossier(s) hors délai
                        </p>
                      </div>
                      <div className="role-banner-actions">
                        {lateCount > 0 && (
                          <button
                            onClick={() => {
                              setScope('Hors délai (SLA)');
                              setPeriod('99999');
                              setPage('dossiers');
                              setFilter('Tous');
                            }}
                          >
                            Hors délai ({lateCount}) →
                          </button>
                        )}
                        {admin && toCheckCount > 0 && (
                          <button onClick={openToCheck}>À vérifier ({toCheckCount}) →</button>
                        )}
                        <button
                          onClick={() => {
                            setScope('Relances transporteur');
                            setPeriod('99999');
                            setPage('dossiers');
                            setFilter('Tous');
                          }}
                        >
                          Relances transporteur →
                        </button>
                        <button
                          onClick={() => {
                            setPage('dossiers');
                            setFilter(
                              creatorView ? 'En attente RC' : litigeView ? 'Nouveau' : 'Tous',
                            );
                          }}
                        >
                          Voir les dossiers prioritaires →
                        </button>
                      </div>
                    </div>
                    <div className="kpi-grid">
                      {cards.map((card, i: number) => (
                        <Kpi
                          key={card.scope}
                          label={card.label}
                          value={
                            card.kind === 'money'
                              ? // Grands montants sans centimes, pour tenir dans la carte
                                Math.abs(card.value) >= 10000
                                ? new Intl.NumberFormat('fr-FR', {
                                    style: 'currency',
                                    currency: 'EUR',
                                    maximumFractionDigits: 0,
                                  }).format(card.value)
                                : money(card.value)
                              : card.kind === 'days'
                                ? card.value.toLocaleString('fr-FR', {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1,
                                  }) + ' j'
                                : card.value
                          }
                          icon={
                            i === 0 ? (
                              <FolderOpen size={18} />
                            ) : i === 1 ? (
                              <Monitor size={18} />
                            ) : i === 2 ? (
                              <ArrowUpRight size={18} />
                            ) : (
                              <Clock size={18} />
                            )
                          }
                          foot={
                            card.scope === 'Avoirs en attente'
                              ? card.rows.length + ' dossier(s) concerné(s)'
                              : card.scope === 'Montant moyen des litiges'
                                ? 'Sur ' + card.rows.length + ' dossier(s)'
                                : i === 2
                                  ? card.rows.length + ' avoirs renseignés'
                                  : i === 3
                                    ? card.rows.length + ' clôtures datées · délai calendaire'
                                    : creatorView
                                      ? i === 0
                                        ? 'Réponses à transmettre au service litige'
                                        : 'Créés ou transmis par votre compte'
                                      : litigeView
                                        ? i === 0
                                          ? 'Nouveaux dossiers à prendre en charge'
                                          : 'Demandes à décider ou à émettre'
                                        : i === 0
                                          ? 'Dossiers encore en cours'
                                          : card.rows.length + ' dossiers au total'
                          }
                          accent={['violet', 'blue', 'orange', 'green'][i]}
                          onClick={() => showKpi(card.scope)}
                        />
                      ))}
                    </div>
                    {page === 'overview' && (
                      <DashboardVisuals
                        records={records}
                        members={data.members}
                        view={dashView}
                        onStatus={(status: string) => {
                          setPage('dossiers');
                          setFilter(status);
                          setQ('');
                          setOrigin('Toutes');
                          setScope('Tous les dossiers');
                          setPeriod('99999');
                        }}
                      />
                    )}
                    <section className="panel dossiers">
                      <div className="panel-heading">
                        <div className="title-count">
                          <h2>
                            {page === 'overview'
                              ? 'Les derniers dossiers'
                              : kpiScopes.includes(scope) || scope === TO_CHECK
                                ? scope
                                : 'Tous les dossiers'}
                          </h2>
                          <span>{filtered.length}</span>
                        </div>
                        <div className="panel-actions">
                          {page === 'dossiers' && admin && toCheckCount > 0 && (
                            <button
                              type="button"
                              className={'to-check-btn' + (scope === TO_CHECK ? ' active' : '')}
                              aria-pressed={scope === TO_CHECK}
                              title="Dossiers pré-remplis à contrôler, et dossiers résolus sans résultat ou sans imputation"
                              onClick={() => {
                                if (scope === TO_CHECK) setScope('Tous les dossiers');
                                else openToCheck();
                              }}
                            >
                              <Sparkles size={15} /> À vérifier <b>{toCheckCount}</b>
                            </button>
                          )}
                          {page === 'dossiers' && (
                            <div className="list-mode" role="group" aria-label="Présentation">
                              <button
                                type="button"
                                aria-pressed={listMode === 'standard'}
                                className={listMode === 'standard' ? 'active' : ''}
                                onClick={() => setListMode('standard')}
                              >
                                Liste
                              </button>
                              <button
                                type="button"
                                aria-pressed={listMode === 'tracking'}
                                className={listMode === 'tracking' ? 'active' : ''}
                                onClick={() => setListMode('tracking')}
                              >
                                Suivi de bout en bout
                              </button>
                            </div>
                          )}
                          {admin && (
                            <button className="text-btn" onClick={() => setModal('import')}>
                              Importer Excel
                            </button>
                          )}
                          <button className="text-btn" onClick={exportCSV}>
                            <ArrowDownToLine size={15} />
                            Exporter
                          </button>
                          <button
                            className="icon-btn"
                            aria-label="Actualiser"
                            disabled={busy}
                            onClick={async () => {
                              if (demo) setNotice('Données de démonstration à jour');
                              else
                                try {
                                  await load();
                                  setNotice('Dossiers actualisés');
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : String(e));
                                }
                            }}
                          >
                            <RefreshCw size={15} />
                          </button>
                        </div>
                      </div>
                      {page === 'dossiers' && (
                        <HelpTip id="liste-dossiers" title="La liste des dossiers">
                          <ul>
                            <li>
                              Recherchez par dossier, commande, client, ticket, BT ou avoir ; « Plus
                              de filtres » pour l’enseigne, le transporteur, le montant…
                            </li>
                            <li>
                              Cochez des dossiers pour agir en une fois : attribuer, changer le
                              statut, suivre, exporter.
                            </li>
                            <li>
                              Barre de couleur à gauche : montant élevé (orange) ou très élevé
                              (rouge). Cliquez sur une ligne pour ouvrir le dossier.
                            </li>
                          </ul>
                        </HelpTip>
                      )}
                      <div className="table-controls">
                        <div className="search">
                          <Search size={17} />
                          <input
                            aria-label="Rechercher un dossier"
                            placeholder="Rechercher : dossier, commande, client, ticket, BT, avoir, facture…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                          />
                        </div>
                        <select
                          aria-label="Origine"
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                        >
                          <option value="Toutes">Toutes les origines</option>
                          <option>Transport</option>
                          <option>Interne</option>
                        </select>
                        <PeriodPicker value={period} onChange={setPeriod} />
                      </div>
                      <ListTools
                        adv={adv}
                        setAdv={setAdv}
                        busy={busy}
                        views={(demo ? data.roleViews?.[view] : data.savedViews) || []}
                        team={roleLabel(demo ? view : me.role)}
                        options={{
                          brands: [
                            ...new Set([
                              ...(data.catalogs?.brands || brands),
                              ...(records.map((x) => x.brand).filter(Boolean) as string[]),
                            ]),
                          ].sort(),
                          carriers: [
                            ...new Set([
                              ...(data.catalogs?.carriers || carriers),
                              ...(records.map((x) => x.carrier).filter(Boolean) as string[]),
                            ]),
                          ].sort(),
                          types: [
                            ...new Set([
                              ...(data.types || []),
                              ...records.map((x) => x.type).filter(Boolean),
                            ]),
                          ].sort(),
                          // Ordre de la liste des Paramètres (PC, PC Portable, Composant…)
                          products: [
                            ...new Set([
                              ...(data.catalogs?.products || products),
                              ...(records.map((x) => x.productType).filter(Boolean) as string[]),
                            ]),
                          ],
                        }}
                        current={{ q, status: filter, origin, scope, period, adv }}
                        onApply={(f) => {
                          setQ(f.q || '');
                          setFilter(f.status || 'Tous');
                          setOrigin(f.origin || 'Toutes');
                          setScope(f.scope || 'Tous les dossiers');
                          setPeriod(f.period || '30');
                          setAdv({ ...EMPTY_ADVANCED, ...(f.adv || {}) });
                        }}
                        onAddView={(v) => action({ action: 'view-add', view: v })}
                        onDeleteView={(id: string) => action({ action: 'view-delete', id })}
                      />
                      <div className="filter-row">
                        <div className="filter-tabs">
                          {[...statuses, 'Tous'].map((s) => (
                            <button
                              className={filter === s ? 'active' : ''}
                              key={s}
                              onClick={() => setFilter(s)}
                            >
                              {s}
                              <span>{statusCount(s)}</span>
                            </button>
                          ))}
                        </div>
                        {page === 'dossiers' && (
                          <select
                            aria-label="Tri par date de déclaration"
                            title="Tri par date de déclaration"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                          >
                            <option value="desc">Plus récentes d’abord</option>
                            <option value="asc">Plus anciennes d’abord</option>
                          </select>
                        )}
                        <select
                          aria-label="Périmètre"
                          value={scope}
                          onChange={(e) => {
                            setScope(e.target.value);
                            // À vérifier : tous les dossiers concernés, quelle que soit leur date
                            if (e.target.value === TO_CHECK) setPeriod('99999');
                          }}
                        >
                          <option>Tous les dossiers</option>
                          <option>Mes dossiers</option>
                          <option>Relances transporteur</option>
                          <option>En attente transporteur</option>
                          <option>Hors délai (SLA)</option>
                          <option>Avoirs en cours</option>
                          {(admin || scope === TO_CHECK) && (
                            <option value={TO_CHECK}>
                              {TO_CHECK} ({toCheckCount})
                            </option>
                          )}
                          {kpiScopes.map((label) => (
                            <option key={label}>{label}</option>
                          ))}
                        </select>
                      </div>
                      {page === 'dossiers' && outsidePeriod > 0 && (
                        <div className="kpi-filter-note period-note">
                          <span>
                            Période : <strong>{periodLabel(period) || 'dates choisies'}</strong> ·{' '}
                            {outsidePeriod} dossier(s) déclaré(s) en dehors ne sont pas affichés
                          </span>
                          <button
                            type="button"
                            className="text-btn"
                            onClick={() => setPeriod('99999')}
                          >
                            Voir toute la période
                          </button>
                        </div>
                      )}
                      {page === 'dossiers' && listAFilters && (
                        <div className="kpi-filter-note analytics-list-note">
                          <span>
                            Filtres des analyses :{' '}
                            <strong>
                              {describeAnalytics(listAFilters, data.members).join(' · ')}
                            </strong>{' '}
                            · {filtered.length} dossier(s)
                          </span>
                          <button
                            type="button"
                            className="text-btn"
                            onClick={() => setListAFilters(null)}
                          >
                            Retirer ces filtres <X size={14} />
                          </button>
                        </div>
                      )}
                      {scope === TO_CHECK && (
                        <div className="kpi-filter-note to-check-note">
                          <span>
                            <strong>{filtered.length} dossier(s) à vérifier ou compléter</strong> ·
                            pré-remplis : contrôlez les champs signalés puis « C’est vérifié » ;
                            résolus incomplets : renseignez le résultat et l’imputation (partie 5),
                            puis « Enregistrer le traitement ». Le dossier sort alors de cette
                            liste.
                          </span>
                          <button
                            type="button"
                            className="text-btn"
                            onClick={() => setScope('Tous les dossiers')}
                          >
                            Retirer ce filtre <X size={14} />
                          </button>
                        </div>
                      )}
                      {kpiScopes.includes(scope) && (
                        <div className="kpi-filter-note">
                          <span>
                            Indicateur : <strong>{scope}</strong> · {filtered.length} dossier(s)
                          </span>
                          <button
                            type="button"
                            className="text-btn"
                            onClick={() => setScope('Tous les dossiers')}
                          >
                            Retirer ce filtre <X size={14} />
                          </button>
                        </div>
                      )}
                      {page === 'dossiers' && picked.length > 0 && (
                        <BulkBar
                          count={picked.length}
                          canEdit={canEdit}
                          agents={data.members.filter((m) => m.role !== 'Désactivé')}
                          busy={busy}
                          onAssign={(email) => bulkRun('assign', email)}
                          onStatus={(s) => bulkRun('status', s)}
                          onWatch={(on) => bulkRun('watch', on)}
                          onExport={() => exportCSV(records.filter((x) => picked.includes(x.id)))}
                          onClear={() => setPicked([])}
                        />
                      )}
                      <div className="table-scroll">
                        {page === 'dossiers' && listMode === 'tracking' ? (
                          <TrackingTable
                            records={filtered.slice(0, shown)}
                            onOpen={open}
                            amountAlerts={amountAlerts}
                          />
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                {page === 'dossiers' && (
                                  <th className="pick-col">
                                    <input
                                      type="checkbox"
                                      aria-label="Tout sélectionner"
                                      title="Sélectionner les dossiers affichés"
                                      checked={
                                        filtered.slice(0, shown).length > 0 &&
                                        filtered.slice(0, shown).every((x) => picked.includes(x.id))
                                      }
                                      onChange={(e) =>
                                        setPicked(
                                          e.target.checked
                                            ? [
                                                ...new Set([
                                                  ...picked,
                                                  ...filtered.slice(0, shown).map((x) => x.id),
                                                ]),
                                              ]
                                            : [],
                                        )
                                      }
                                    />
                                  </th>
                                )}
                                <th>Dossier / client</th>
                                <th>Origine</th>
                                <th>Type de litige</th>
                                <th>Statut</th>
                                <th>Montant en litige</th>
                                <th>
                                  {page === 'dossiers' ? (
                                    <button
                                      type="button"
                                      className="sort-header"
                                      title="Changer l’ordre de tri"
                                      onClick={() =>
                                        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                                      }
                                    >
                                      Déclaré le {sortOrder === 'desc' ? '↓' : '↑'}
                                    </button>
                                  ) : (
                                    'Déclaré le'
                                  )}
                                </th>
                                <th>Agent</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.slice(0, page === 'overview' ? 6 : shown).map((x) => (
                                <tr
                                  key={x.id}
                                  data-record-id={x.id}
                                  {...amountMark(x, amountAlerts)}
                                  onClick={() => openFromList(x)}
                                  className={
                                    [
                                      amountMark(x, amountAlerts).className,
                                      picked.includes(x.id) ? 'picked' : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ') || undefined
                                  }
                                >
                                  {page === 'dossiers' && (
                                    <td className="pick-col" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        aria-label={'Sélectionner ' + x.ref}
                                        checked={picked.includes(x.id)}
                                        onChange={(e) =>
                                          setPicked(
                                            e.target.checked
                                              ? [...picked, x.id]
                                              : picked.filter((id) => id !== x.id),
                                          )
                                        }
                                      />
                                    </td>
                                  )}
                                  <td>
                                    <button
                                      className="row-title"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openFromList(x);
                                      }}
                                    >
                                      {x.priority === 'Haute' && <span className="priority-dot" />}
                                      {x.title}
                                    </button>
                                    <div className="row-sub">
                                      <b>{x.ref}</b>
                                      <span>·</span>
                                      <BrandName brand={x.brand} store={x.store} />
                                      <span>·</span>
                                      {x.customer}
                                    </div>
                                  </td>
                                  <td>
                                    <span className="origin">
                                      {x.origin === 'Transport' ? (
                                        <Truck size={15} />
                                      ) : (
                                        <Monitor size={15} />
                                      )}
                                      <span>
                                        {x.origin}
                                        <small>
                                          {x.origin === 'Transport'
                                            ? x.carrier
                                            : 'SAV informatique'}
                                        </small>
                                      </span>
                                    </span>
                                  </td>
                                  <td className="litige-type">
                                    {x.type || '—'}
                                    {x.productType && <small>{x.productType}</small>}
                                  </td>
                                  <td>
                                    <Badge status={x.status} />
                                    {lateOf(x).length > 0 && (
                                      <span
                                        className="late-badge"
                                        title={lateOf(x)
                                          .map(
                                            (l) =>
                                              l.rule.label +
                                              ' : dépassé de ' +
                                              formatHours(l.overdueHours),
                                          )
                                          .join('\n')}
                                      >
                                        <Timer size={11} /> Hors délai
                                      </span>
                                    )}
                                  </td>
                                  <td className="amount">
                                    {money(stakeOf(x))}
                                    <small>{x.order}</small>
                                  </td>
                                  <td className="table-date">
                                    {date(x.created)}
                                    <small>Il y a {Math.floor(days(x.created))} j</small>
                                  </td>
                                  <td>
                                    {x.assignee ? (
                                      <span
                                        className="agent-avatar"
                                        title={
                                          data.members.find((m) => m.email === x.assignee)?.name ||
                                          x.assignee
                                        }
                                      >
                                        {(
                                          data.members.find((m) => m.email === x.assignee)?.name ||
                                          x.assignee
                                        )
                                          .split(' ')
                                          .map((a: string) => a[0])
                                          .slice(0, 2)
                                          .join('')}
                                      </span>
                                    ) : (
                                      <span className="unassigned">—</span>
                                    )}
                                  </td>
                                  <td className="row-end">
                                    <DossierRecap
                                      r={x}
                                      agent={
                                        x.assignee
                                          ? data.members.find((m) => m.email === x.assignee)
                                              ?.name || x.assignee
                                          : ''
                                      }
                                    />
                                    <ChevronRight size={15} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {!filtered.length && (
                          <div className="empty">
                            <FolderOpen size={30} />
                            <h3>Aucun dossier pour le moment</h3>
                            <p>
                              {records.length
                                ? 'Ajustez les filtres ou votre recherche.'
                                : 'Créez votre premier litige pour commencer le suivi.'}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="table-footer">
                        <span>
                          {Math.min(filtered.length, page === 'overview' ? 6 : shown)} dossier(s)
                          affiché(s) sur {filtered.length}
                          {page !== 'overview' && filtered.length > shown && (
                            <button
                              type="button"
                              className="text-btn show-more"
                              onClick={() => setShown(shown + 200)}
                            >
                              Afficher les {Math.min(200, filtered.length - shown)} suivants
                            </button>
                          )}
                        </span>
                        {page === 'overview' ? (
                          <button className="text-btn" onClick={showAllDossiers}>
                            Voir tous les dossiers
                            <ChevronRight size={14} />
                          </button>
                        ) : (
                          <span className="table-footer-end">
                            Les filtres s’appliquent aussi à l’export
                            <button
                              type="button"
                              className="secondary small-btn"
                              onClick={showAllDossiers}
                            >
                              Voir tous les dossiers
                              <ChevronRight size={14} />
                            </button>
                          </span>
                        )}
                      </div>
                    </section>
                  </>
                )}
                {page === 'analytics' && seesAnalytics(view) && (
                  <HelpTip id="analyses" title="Analyses litiges">
                    <ul>
                      <li>
                        La barre de filtres en haut s’applique à tout l’écran : chiffres, graphiques
                        et tableau du bas.
                      </li>
                      <li>
                        « Voir les dossiers concernés » ouvre la liste avec la même période et les
                        mêmes filtres.
                      </li>
                      <li>
                        Survolez un graphique pour lire les chiffres ; cliquez sur un statut pour
                        ouvrir la liste correspondante.
                      </li>
                      <li>
                        « Rapport (PDF) » : synthèse d’un mois ou de dates choisies, à télécharger
                        ou imprimer.
                      </li>
                    </ul>
                  </HelpTip>
                )}
                {page === 'analytics' && seesAnalytics(view) && (
                  <AnalyticsDashboard
                    records={analyticsRecords}
                    members={data.members}
                    period={period}
                    onPeriod={setPeriod}
                    onExport={(rows) => exportCSV(rows)}
                    toolbar={
                      <AnalyticsFilterBar
                        filters={aFilters}
                        onChange={setAFilters}
                        options={analyticsOptions}
                        period={period}
                        onPeriod={setPeriod}
                        shown={analyticsRecords.filter((r) => inPeriodOf(r.created, period)).length}
                        total={records.filter((r) => inPeriodOf(r.created, period)).length}
                        onExport={() =>
                          exportCSV(analyticsRecords.filter((r) => inPeriodOf(r.created, period)))
                        }
                        onOpenList={() => openAnalyticsList()}
                        onReport={() =>
                          setReportView({
                            title: 'Rapport des litiges',
                            filters: aFilters,
                            kind: 'monthly',
                            periodKey: lastClosedPeriod('monthly').key,
                            manual: true,
                          })
                        }
                      />
                    }
                    onStatus={(status: string) => openAnalyticsList(status)}
                  />
                )}
                {page === 'analytics' && seesAnalytics(view) && (
                  <CarrierCostPanel
                    records={analyticsRecords}
                    members={data.members}
                    period={period}
                    slaNow={slaNow}
                    onOpen={(x) => open(x)}
                  />
                )}
                {page === 'analytics' && seesAnalytics(view) && (
                  <OutcomeStats records={analyticsRecords} period={period} slaNow={slaNow} />
                )}
                {page === 'analytics' && seesAnalytics(view) && (
                  <StatsTable
                    records={analyticsRecords}
                    members={data.members}
                    rules={slaRules}
                    period={period}
                    slaNow={slaNow}
                    shipments={data.shipments}
                  />
                )}
                {page === 'contentieux-analytics' && admin && (
                  <ContentieuxDashboard
                    items={data.contentieux || []}
                    records={data.records}
                    settings={ctSettings}
                    brands={data.catalogs?.brands || brands}
                    today={creditToday()}
                  />
                )}
                {page === 'contentieux' && admin && (
                  <ContentieuxView
                    items={data.contentieux || []}
                    records={data.records}
                    brands={data.catalogs?.brands || brands}
                    today={creditToday()}
                    busy={busy}
                    onAction={(p) => action(p as ActionPayload)}
                    onOpenDossier={(x) => open(x)}
                    focus={ctFocus}
                    onFocusDone={() => setCtFocus(null)}
                    settings={ctSettings}
                    member={me}
                    demo={demo}
                    onReload={async (message: string) => {
                      setError('');
                      try {
                        await load(true);
                        setNotice(message);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                  />
                )}
                {page === 'my-data' && creatorView && <MyData records={records} email={me.email} />}
                {page === 'credits' && canEdit && (
                  <CreditQueue
                    records={records}
                    members={data.members}
                    member={{ ...me, role: demo ? view : me.role }}
                    settings={creditSettings}
                    busy={busy}
                    onAction={(x, payload) => action({ ...payload, id: x.id } as ActionPayload)}
                    onOpen={(x) => open(x)}
                  />
                )}
                {page === 'team' && admin && (
                  <>
                    <div className="team-intro">
                      <ShieldCheck size={20} />
                      <p>
                        {demo
                          ? 'Explorez les rôles avec ces comptes fictifs. Dans l’espace réel, chaque agent se connecte avec son propre compte.'
                          : 'Les adresses autorisées doivent correspondre au compte de connexion de chaque agent (son adresse Microsoft une fois l’outil installé chez Cybertek).'}
                      </p>
                    </div>
                    <HelpTip id="equipe" title="Équipe & accès">
                      <p>
                        Ajoutez chaque agent avec son adresse de connexion et son service : il voit
                        et peut faire ce que permet son service. « Désactivé » coupe l’accès sans
                        effacer l’historique. « Inviter » ouvre dans votre messagerie un e-mail tout
                        prêt (lien de l’outil, adresse de connexion, service) : relisez-le puis
                        envoyez-le à l’agent.
                      </p>
                    </HelpTip>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Agents et services</h2>
                        <span className="muted">{teamAccounts.length} agents</span>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Agent</th>
                              <th>Adresse e-mail</th>
                              <th>Service</th>
                              <th>Profils</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamAccounts.map((m) => (
                              <tr key={m.email}>
                                <td>
                                  <div className="member-cell">
                                    <span className="avatar">{m.name[0]}</span>
                                    <b>{m.name}</b>
                                  </div>
                                </td>
                                <td>{m.email}</td>
                                <td>
                                  <span className="service-pill">{m.role}</span>
                                </td>
                                <td>
                                  {(data.memberProfiles?.[m.email] || []).join(', ') || '—'}
                                  {admin && !demo && (
                                    <button
                                      className="text-btn"
                                      title="Adresse utilisée par plusieurs personnes (ex. boîte du Service Litige)"
                                      onClick={() => {
                                        setProfileForm({
                                          email: m.email,
                                          value: (data.memberProfiles?.[m.email] || []).join(', '),
                                        });
                                        setModal('profiles');
                                      }}
                                    >
                                      Profils
                                    </button>
                                  )}
                                </td>
                                <td>
                                  {admin && (
                                    <button
                                      className="text-btn"
                                      onClick={() => {
                                        setMemberForm(m);
                                        setModal('member');
                                      }}
                                    >
                                      Modifier
                                      <ChevronRight size={13} />
                                    </button>
                                  )}
                                  {admin &&
                                    !demo &&
                                    m.email !== me.email &&
                                    (() => {
                                      const invite = invitationMail(
                                        m,
                                        window.location.origin,
                                        me.name,
                                      );
                                      return invite ? (
                                        <a
                                          className="text-btn invite-btn"
                                          href={invite.href}
                                          title="Ouvre un e-mail d’invitation prêt à envoyer dans votre messagerie"
                                        >
                                          <Mail size={13} />
                                          Inviter
                                        </a>
                                      ) : null;
                                    })()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {admin && (
                        <div className="table-footer">
                          <button
                            className="primary"
                            onClick={() => {
                              setMemberForm({ name: '', email: '', role: 'RC' });
                              setModal('member');
                            }}
                          >
                            <Plus size={16} />
                            Autoriser un agent
                          </button>
                          <small>
                            « Inviter » prépare l’e-mail d’invitation dans votre messagerie : vous
                            le relisez et l’envoyez.
                          </small>
                        </div>
                      )}
                    </section>
                    {admin && (
                      <section className="panel access-log">
                        <div className="panel-heading">
                          <h2>Journal des accès</h2>
                          <span className="muted">Qui a donné ou retiré quel accès, et quand</span>
                        </div>
                        {(data.accessLog || []).length ? (
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Agent concerné</th>
                                  <th>Changement</th>
                                  <th>Par</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.accessLog!.map((entry, i: number) => (
                                  <tr key={entry.date + i}>
                                    <td>{dateTime(entry.date)}</td>
                                    <td>
                                      {entry.after?.name || entry.email}
                                      <small className="muted"> · {entry.email}</small>
                                    </td>
                                    <td>{describeAccessChange(entry)}</td>
                                    <td>{entry.byName || entry.by}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="muted access-log-empty">
                            Aucun changement d’accès enregistré pour l’instant.
                          </p>
                        )}
                      </section>
                    )}
                    <div className="role-cards">
                      {roles.map((role, i) => (
                        <section className="panel" key={role}>
                          <span className={'role-icon r' + Math.max(0, i - 1)}>
                            {roleIcon(role)}
                          </span>
                          <h3>{roleLabel(role)}</h3>
                          <p>{roleDescriptions[role]}</p>
                        </section>
                      ))}
                    </div>
                  </>
                )}
                {page === 'settings' && admin && (
                  <>
                    {/* Paramètres en deux parties : litiges et contentieux */}
                    <div className="settings-tabs" role="tablist" aria-label="Paramètres">
                      {(
                        [
                          ['litiges', 'Paramètres litiges'],
                          ['transporteurs', 'Transporteurs'],
                          ['contentieux', 'Paramètres contentieux'],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={settingsTab === key}
                          className={settingsTab === key ? 'active' : ''}
                          onClick={() => setSettingsTab(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {settingsTab === 'transporteurs' && (
                      <>
                        <HelpTip id="parametres-transporteurs" title="Transporteurs">
                          <p>
                            Deux connexions différentes : les API de suivi des colis (étapes du
                            colis dans chaque dossier) et les formulaires de réclamation du service
                            client de chaque transporteur (ouverts depuis l’onglet Transporteur du
                            dossier).
                          </p>
                        </HelpTip>
                        <h2 className="settings-title">API de suivi des colis</h2>
                        <div className="overview-grid">
                          <CarrierApiSettings
                            status={data.carrierApis || {}}
                            demo={demo}
                            onChanged={() => load(true)}
                          />
                          <TrackingLinkSettings
                            key={'tracking-' + JSON.stringify(data.trackingLinks || {})}
                            links={data.trackingLinks || DEFAULT_TRACKING_LINKS}
                            carriers={data.catalogs?.carriers || carriers}
                            busy={busy}
                            onSave={(links) => action({ action: 'tracking-links', links })}
                          />
                        </div>
                        <h2 className="settings-title">Formulaires de réclamation</h2>
                        <div className="overview-grid">
                          <ClaimFormSettings
                            key={'claim-forms-' + JSON.stringify(data.claimForms || {})}
                            forms={data.claimForms || {}}
                            carriers={data.catalogs?.carriers || carriers}
                            busy={busy}
                            onSave={(forms) =>
                              action({ action: 'claim-forms', forms } as ActionPayload)
                            }
                          />
                          <CarrierDelaySettings
                            key={'delays-' + JSON.stringify(carrierDelays)}
                            delays={carrierDelays}
                            busy={busy}
                            onSave={(delays) =>
                              action({ action: 'carrier-delays', delays } as ActionPayload)
                            }
                          />
                        </div>
                      </>
                    )}
                    {settingsTab === 'contentieux' && (
                      <ContentieuxSettingsPanel
                        key={JSON.stringify(ctSettings)}
                        settings={ctSettings}
                        items={data.contentieux || []}
                        busy={busy}
                        onSave={(save) =>
                          action({
                            action: 'contentieux-settings',
                            ...save,
                          } as unknown as ActionPayload)
                        }
                      />
                    )}
                    {settingsTab === 'litiges' && (
                      <>
                        <HelpTip id="parametres" title="Paramètres (admins)">
                          <p>
                            Chaque bloc s’enregistre séparément avec son propre bouton. Les listes
                            (types, enseignes, transporteurs…) sont en bas ; renommer une valeur
                            peut aussi corriger les anciens dossiers.
                          </p>
                        </HelpTip>
                        <div className="overview-grid">
                          <CreditSettings
                            key={'credit-' + JSON.stringify(creditSettings)}
                            settings={creditSettings}
                            admin={admin}
                            busy={busy}
                            onSave={(settings) => action({ action: 'credit-settings', settings })}
                          />
                          <SignatureSettings
                            key={'signatures-' + JSON.stringify(data.mailSignatures || []).length}
                            signatures={data.mailSignatures || DEFAULT_SIGNATURES}
                            admin={admin}
                            busy={busy}
                            onSave={(signatures) =>
                              action({ action: 'mail-signatures', signatures } as ActionPayload)
                            }
                          />
                          <TrashSettingsPanel
                            key={'trash-' + JSON.stringify(data.trashSettings || null)}
                            settings={data.trashSettings || DEFAULT_TRASH_SETTINGS}
                            admin={admin}
                            busy={busy}
                            onSave={(settings) =>
                              action({
                                action: 'trash-settings',
                                settings,
                              } as unknown as ActionPayload)
                            }
                          />
                          <SlaSettings
                            key={JSON.stringify(slaRules)}
                            rules={slaRules}
                            admin={admin}
                            busy={busy}
                            onSave={(sla) => action({ action: 'sla', sla })}
                          />
                          <ReportSettings
                            key={'reports-' + JSON.stringify(data.reports || [])}
                            reports={(data.reports || []) as ScheduledReport[]}
                            options={analyticsOptions}
                            busy={busy}
                            onSave={(reports) =>
                              action({ action: 'reports', reports } as ActionPayload)
                            }
                            onPreview={(def) =>
                              setReportView({
                                title: def.name || 'Rapport',
                                filters: def.filters,
                                kind: def.frequency,
                                periodKey: lastClosedPeriod(def.frequency).key,
                              })
                            }
                          />
                          <RepeatAlertSettings
                            key={'repeat-' + JSON.stringify(repeatAlerts)}
                            alerts={repeatAlerts}
                            busy={busy}
                            onSave={(alerts) =>
                              action({ action: 'repeat-alerts', alerts } as ActionPayload)
                            }
                          />
                          <AmountAlertSettings
                            key={'alerts-' + JSON.stringify(amountAlerts)}
                            alerts={amountAlerts}
                            busy={busy}
                            onSave={(alerts) => action({ action: 'amount-alerts', alerts })}
                          />
                          <ShipmentSettings
                            shipments={data.shipments || {}}
                            info={data.shipmentsInfo}
                            carriers={data.catalogs?.carriers || carriers}
                            busy={busy}
                            welcometrack={data.welcometrackSync}
                            welcometrackConnected={!!data.carrierApis?.welcometrack?.configured}
                            onWelcometrack={(body) => action(body as ActionPayload)}
                          />
                          <section className="panel settings-panel">
                            <div className="integration-icon">
                              <Link2 size={24} />
                            </div>
                            <h2>Notifications Teams & Outlook</h2>
                            <span className="badge pending">Connexion mise en attente</span>
                            <p>
                              Les mentions et commentaires sont disponibles dans l’application.
                              Aucun message Teams ni e-mail Outlook n’est envoyé actuellement.
                            </p>
                            <p>
                              La connexion Microsoft 365 nécessitera le choix du canal et
                              l’autorisation de votre administrateur.
                            </p>
                            <div className="integration-note">
                              <Bell size={17} />
                              <span>
                                Notifications internes activées pour les agents mentionnés.
                              </span>
                            </div>
                            <p className="muted">
                              La connexion Outlook sera reprise ultérieurement. Les échanges
                              transporteur peuvent être consignés manuellement dans les dossiers.
                            </p>
                          </section>
                        </div>
                        {/* Listes métier : ajouter, renommer, déplacer, supprimer (responsables) */}
                        <h2 className="settings-title">Listes métier</h2>
                        <div className="catalog-grid list-grid">
                          {(Object.keys(LIST_DEFS) as (keyof typeof LIST_DEFS)[]).map((key) => {
                            const def = LIST_DEFS[key];
                            const values =
                              key === 'types'
                                ? data.types
                                : (data.catalogs as unknown as Record<string, string[]>)?.[key] ||
                                  (DEFAULT_LISTS as Record<string, string[]>)[key];
                            const usage: Record<string, number> = {};
                            for (const x of records) {
                              const v = String(
                                (x as unknown as Record<string, unknown>)[def.field] ?? '',
                              );
                              if (v) usage[v] = (usage[v] || 0) + 1;
                            }
                            return (
                              <ListEditor
                                key={
                                  key +
                                  ':' +
                                  JSON.stringify(values) +
                                  JSON.stringify(key === 'brands' ? brandColors : '')
                                }
                                title={def.label}
                                help={LIST_HELP[key]}
                                values={values}
                                locked={(LOCKED as Record<string, string[]>)[key]}
                                colors={key === 'brands' ? brandColors : undefined}
                                usage={usage}
                                busy={busy}
                                onSave={(save) =>
                                  action({ action: 'list-update', list: key, ...save })
                                }
                              />
                            );
                          })}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
            <footer className="footer">
              <span>
                <span className="brand-dot">●</span> OptiLitige · La résolution, en équipe.
              </span>
              <span>
                {demo ? 'Environnement de démonstration' : 'Espace sécurisé · Données partagées'}
              </span>
            </footer>
          </div>
          {reportView && (
            <ReportView
              title={reportView.title}
              blocked={
                reportView.kind === 'range' ? rangeError(reportView.from, reportView.to) : ''
              }
              data={
                buildReport(
                  records,
                  reportView.kind === 'weekly'
                    ? weekPeriod(reportView.periodKey)
                    : reportView.kind === 'range'
                      ? rangeError(reportView.from, reportView.to)
                        ? monthPeriod(lastClosedPeriod('monthly').key)
                        : rangePeriod(reportView.from, reportView.to)
                      : monthPeriod(reportView.periodKey),
                  reportView.filters,
                  data.members,
                ) as ReportData
              }
              onClose={() => setReportView(null)}
              toolbar={
                <ReportPeriod
                  value={reportView}
                  onChange={(v) => setReportView({ ...reportView, ...v })}
                  error={
                    reportView.kind === 'range' ? rangeError(reportView.from, reportView.to) : ''
                  }
                />
              }
            />
          )}
        </main>
      </ChartPrefsContext.Provider>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {!demo && !!me.profiles?.length && !me.profile && (
        <div className="modal-overlay">
          <section className="modal profile-picker" role="dialog" aria-label="Qui êtes-vous ?">
            <span className="eyebrow">ADRESSE PARTAGÉE</span>
            <h2>Qui êtes-vous ?</h2>
            <p>
              L’adresse {me.account || me.email} est utilisée par plusieurs personnes. Choisissez
              votre profil : vos actions, vos mentions et vos notifications seront à votre nom. Le
              choix est retenu sur ce poste.
            </p>
            <div className="profile-choices">
              {me.profiles.map((p) => (
                <button
                  key={p}
                  className="primary"
                  disabled={busy}
                  onClick={() => chooseProfile(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!busy) setModal('');
          }}
        >
          <section
            className={
              'modal ' +
              (modal === 'new' || modal === 'edit-info'
                ? 'large'
                : modal === 'import'
                  ? 'importer'
                  : '')
            }
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'new'
                ? 'Nouveau litige'
                : modal === 'edit-info'
                  ? 'Modifier les informations'
                  : modal === 'member'
                    ? 'Compte agent'
                    : 'Informations'
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-btn"
              aria-label="Fermer"
              onClick={() => setModal('')}
            >
              <X size={20} />
            </button>
            {modal === 'edit-info' && r ? (
              <EditInfoForm
                key={r.id + ':' + r.version}
                record={r}
                busy={busy}
                lists={{
                  brands: data.catalogs?.brands || brands,
                  stores: data.catalogs?.stores || stores,
                  products: data.catalogs?.products || products,
                  carriers: data.catalogs?.carriers || carriers,
                  types: data.types,
                }}
                onSave={async (info) => {
                  const ok = await action({
                    action: 'edit-info',
                    id: r.id,
                    version: r.version,
                    rev: r.rev || 0,
                    info,
                  });
                  if (ok) setModal('');
                  return ok;
                }}
              />
            ) : modal === 'close' && r ? (
              <>
                <span className="eyebrow">SERVICE LITIGE · CLÔTURE</span>
                <h2>Clôturer le dossier</h2>
                <p>
                  {r.ref} · le dossier passe « Résolu ». La conclusion (avéré ou non) est déduite du
                  résultat.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await saveTreatment(r, { ...edit, status: 'Résolu' })) setModal('');
                  }}
                >
                  <label>
                    Résultat du litige *
                    <select
                      required
                      value={edit.outcome}
                      onChange={(e) => setTreat({ outcome: e.target.value })}
                    >
                      <option value="">Choisir…</option>
                      {(data.catalogs?.outcomes || outcomes).map((s: string) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Imputation *
                    <select
                      required
                      value={edit.imputation}
                      onChange={(e) => setTreat({ imputation: e.target.value })}
                    >
                      <option value="">Choisir…</option>
                      {imputations.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <small className="field-note">
                      Proposée selon le résultat quand elle est certaine ; à choisir sinon (Interne
                      : notre faute · Transporteur · Autre : un tiers).
                    </small>
                  </label>
                  <button className="primary" disabled={busy}>
                    <CheckCircle2 size={15} /> Clôturer
                  </button>
                </form>
              </>
            ) : modal === 'client' ? (
              <>
                <span className="eyebrow">RELATION CLIENT</span>
                <h2>Suivi de la solution client</h2>
                <p>Renseignez les actions menées après l’analyse du dossier.</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await action({
                        action: 'client-followup',
                        id: r!.id,
                        version: r!.version,
                        clientStage: edit.clientStage,
                        rcCheck: edit.rcCheck,
                        followUp: edit.followUp,
                      })
                    )
                      setModal('');
                  }}
                >
                  <label>
                    Étape côté client
                    <select
                      value={edit.clientStage}
                      onChange={(e) => setEdit({ ...edit, clientStage: e.target.value })}
                    >
                      {/* Ancienne étape reprise de SharePoint, hors liste : affichée telle quelle */}
                      {!clientStages.includes(edit.clientStage as string) && edit.clientStage && (
                        <option>{edit.clientStage}</option>
                      )}
                      {clientStages.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prochaine action client
                    <textarea
                      value={edit.followUp}
                      onChange={(e) => setEdit({ ...edit, followUp: e.target.value })}
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    <Check size={15} />
                    Enregistrer le suivi client
                  </button>
                </form>
              </>
            ) : modal === 'import' ? (
              <Importer onImport={importRecords} busy={busy} />
            ) : modal === 'new' ? (
              <>
                <span className="eyebrow">RELATION CLIENT → SERVICE LITIGE</span>
                <h2>Ouvrir un nouveau litige</h2>
                <p>Rassemblez les informations pour une prise en charge efficace.</p>
                <HelpTip id="creation" title="Créer un litige">
                  <p>
                    Les champs marqués * sont obligatoires. Si un litige existe déjà pour la
                    commande ou si le client a déjà eu plusieurs litiges, un avertissement s’affiche
                    : vérifiez avant de créer. Vous pouvez joindre les photos dès maintenant.
                  </p>
                </HelpTip>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await action({ action: 'create', record: form })) {
                      setModal('');
                      setPage('dossiers');
                      setFilter('Tous');
                      setQ('');
                      // Pièces jointes du formulaire : envoyées une fois le dossier créé
                      const id = createdId.current;
                      if (!demo && id && newFiles.length) {
                        setBusy(true);
                        const problems: string[] = [];
                        for (const [i, file] of newFiles.entries()) {
                          setNotice(
                            'Envoi des pièces jointes ' + (i + 1) + ' / ' + newFiles.length,
                          );
                          const failure = await sendAttachment(id, file);
                          if (failure) problems.push(failure);
                        }
                        setBusy(false);
                        await load(true);
                        if (problems.length)
                          setError(
                            'Dossier créé, mais certaines pièces jointes n’ont pas été ajoutées : ' +
                              problems.join(' '),
                          );
                        else
                          setNotice(
                            'Dossier créé avec ' +
                              newFiles.length +
                              (newFiles.length > 1 ? ' pièces jointes' : ' pièce jointe'),
                          );
                      }
                      setNewFiles([]);
                    }
                  }}
                >
                  <div className="form-grid">
                    <label className="span2">
                      Objet du litige *
                      <input
                        autoFocus
                        required
                        maxLength={200}
                        value={form.title || ''}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Ex. : PC reçu avec la vitre du boîtier brisée"
                      />
                    </label>
                    <label>
                      Enseigne *
                      <select
                        required
                        value={form.brand}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            brand: e.target.value,
                            // Le magasin ne concerne que l'enseigne « MAGASIN »
                            store: e.target.value === STORE_BRAND ? form.store : '',
                          })
                        }
                      >
                        {(data.catalogs?.brands || brands).map((s: string) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    {form.brand === STORE_BRAND && (
                      <label>
                        Magasin *
                        <select
                          required
                          value={form.store || ''}
                          onChange={(e) => setForm({ ...form, store: e.target.value })}
                        >
                          <option value="">Choisir le magasin…</option>
                          {(data.catalogs?.stores || stores).map((s: string) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Type de produit *
                      <select
                        required
                        value={form.productType}
                        onChange={(e) => setForm({ ...form, productType: e.target.value })}
                      >
                        {(data.catalogs?.products || products).map((s: string) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Référence produit
                      <input
                        value={form.productRef || ''}
                        onChange={(e) => setForm({ ...form, productRef: e.target.value })}
                      />
                    </label>
                    <label>
                      Numéro de ticket
                      <input
                        value={form.ticket || ''}
                        onChange={(e) => setForm({ ...form, ticket: e.target.value })}
                      />
                    </label>
                    <label>
                      BT
                      <input
                        value={form.bt || ''}
                        onChange={(e) => setForm({ ...form, bt: e.target.value })}
                      />
                    </label>
                    <label>
                      Demandeur *
                      {/* Comptes Microsoft de l'équipe (Équipe & accès) ; vous-même par défaut.
                          La recherche dans tout l'annuaire Outlook viendra avec Microsoft 365. */}
                      <select
                        required
                        value={form.requesterEmail ?? me.email}
                        onChange={(e) => {
                          const m = requesterChoices.find((x) => x.email === e.target.value);
                          setForm({ ...form, requesterEmail: m?.email, requester: m?.name });
                        }}
                      >
                        {requesterChoices.map((m) => (
                          <option key={m.email} value={m.email}>
                            {m.email === me.email ? m.name + ' (vous)' : m.name} ·{' '}
                            {roleLabel(m.role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Numéro de compte client *
                      <input
                        required
                        maxLength={60}
                        value={form.customerAccount || ''}
                        onChange={(e) => setForm({ ...form, customerAccount: e.target.value })}
                        placeholder="Compte client de l’ERP"
                      />
                    </label>
                    <label>
                      Nom du client (facultatif)
                      <input
                        value={form.customer || ''}
                        onChange={(e) => setForm({ ...form, customer: e.target.value })}
                        placeholder="Prénom et nom"
                      />
                    </label>
                    <label>
                      Référence commande *
                      <input
                        required
                        value={form.order || ''}
                        onChange={(e) => setForm({ ...form, order: e.target.value })}
                        placeholder="CMD-…"
                      />
                    </label>
                    {modal === 'new' && (
                      <div className="span2">
                        <RepeatCustomerBanner
                          customer={form.customer || ''}
                          info={repeatInfo(
                            customers,
                            { customer: form.customer, customerAccount: form.customerAccount },
                            repeatAlerts,
                          )}
                        />
                      </div>
                    )}
                    {duplicates.length > 0 && (
                      <div role="alert" className="duplicate-warning span2">
                        <b>
                          {duplicates.length > 1
                            ? duplicates.length + ' litiges existent déjà pour cette commande :'
                            : 'Un litige existe déjà pour cette commande :'}
                        </b>
                        <ul>
                          {duplicates.slice(0, 5).map((d: Dossier) => (
                            <li key={d.id}>
                              {d.ref} · {d.title} · <Badge status={d.status} /> · ouvert le{' '}
                              {date(d.created)}
                            </li>
                          ))}
                        </ul>
                        <small>
                          Vérifiez qu’il ne s’agit pas du même problème avant de créer un nouveau
                          dossier.
                        </small>
                      </div>
                    )}
                    <label>
                      Montant concerné par le litige (€) *
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.disputeValue}
                        onChange={(e) => setForm({ ...form, disputeValue: e.target.value })}
                      />
                    </label>
                    <label>
                      Origine *
                      <select
                        value={form.origin}
                        onChange={(e) => setForm({ ...form, origin: e.target.value })}
                      >
                        <option>Transport</option>
                        <option>Interne</option>
                      </select>
                    </label>
                    <label>
                      Type à l’ouverture *
                      <select
                        required
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                      >
                        {data.types.map((t: string) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Priorité
                      <select
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      >
                        <option>Normale</option>
                        <option>Haute</option>
                      </select>
                    </label>
                    {form.origin === 'Transport' && (
                      <label className="span2">
                        Transporteur
                        <select
                          value={form.carrier}
                          onChange={(e) => setForm({ ...form, carrier: e.target.value })}
                        >
                          {(data.catalogs?.carriers || carriers).map((s: string) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="span2">
                      Description et éléments du client *
                      <textarea
                        required
                        rows={4}
                        maxLength={10000}
                        value={form.description || ''}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Décrivez le problème et les circonstances…"
                      />
                    </label>
                    <NewAttachments files={newFiles} onChange={setNewFiles} demo={demo} />
                  </div>
                  <div className="modal-footer">
                    <span>Statut initial : Nouveau</span>
                    <button disabled={busy} className="primary">
                      <Send size={16} />
                      {busy
                        ? 'Transmission…'
                        : duplicates.length
                          ? 'Créer quand même'
                          : 'Créer et transmettre'}
                    </button>
                  </div>
                </form>
              </>
            ) : modal === 'profiles' ? (
              <>
                <span className="eyebrow">GESTION DES ACCÈS</span>
                <h2>Profils sur cette adresse</h2>
                <p>
                  {profileForm.email} est utilisée par plusieurs personnes ? Indiquez leurs prénoms
                  : chacun choisira le sien à la connexion. Laissez vide pour une adresse
                  personnelle.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await action({
                        action: 'member-profiles',
                        email: profileForm.email,
                        profiles: profileForm.value,
                      } as ActionPayload)
                    )
                      setModal('');
                  }}
                >
                  <label>
                    Profils (séparés par des virgules)
                    <input
                      value={profileForm.value}
                      placeholder="Aurélien, Lydia"
                      onChange={(e) => setProfileForm({ ...profileForm, value: e.target.value })}
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    <Check size={15} /> Enregistrer
                  </button>
                </form>
              </>
            ) : modal === 'member' ? (
              <>
                <span className="eyebrow">GESTION DES ACCÈS</span>
                <h2>Compte agent</h2>
                <p>
                  Autorisez une adresse et associez-la à un service. Les dossiers repris de
                  SharePoint dont le demandeur porte ce nom (accents et majuscules ignorés) lui sont
                  rattachés.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await action({
                        action: 'member',
                        ...memberForm,
                        email: memberForm.email!.trim().toLowerCase(),
                      })
                    )
                      setModal('');
                  }}
                >
                  <label>
                    Nom complet
                    <input
                      autoFocus
                      required
                      value={memberForm.name}
                      onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                    />
                  </label>
                  <label>
                    Adresse e-mail (compte Microsoft)
                    <input
                      required
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                    />
                  </label>
                  <label>
                    Service
                    <select
                      value={memberForm.role}
                      onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                    >
                      {[...roles, 'Désactivé'].map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </label>
                  <p className="muted">
                    L’autorisation dans l’application ne partage pas automatiquement le site.
                  </p>
                  <button disabled={busy} className="primary full">
                    <Check size={16} />
                    Enregistrer l’agent
                  </button>
                </form>
              </>
            ) : modal === 'integration' ? (
              <>
                <span className="integration-icon">
                  <Link2 />
                </span>
                <h2>Connecter Microsoft 365</h2>
                <p>Cette connexion n’est pas encore activée.</p>
                <ol className="guide">
                  <li>Choisir Teams, Outlook ou les deux.</li>
                  <li>Obtenir l’autorisation de l’administrateur Microsoft 365.</li>
                  <li>Définir les destinataires lors d’une mention.</li>
                  <li>Configurer puis tester l’envoi dans votre environnement.</li>
                </ol>
                <button className="primary" onClick={() => setModal('')}>
                  Compris
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">BIENVENUE SUR OPTILITIGE</span>
                <h2>Du signalement à la solution.</h2>
                <ol className="guide">
                  <li>
                    <b>Relation client et SAV :</b> créez un litige avec la commande, le signalement
                    et les pièces jointes. Le dossier vous appartient.
                  </li>
                  <li>
                    <b>Service litige :</b> prenez en charge, échangez dans les commentaires et avec
                    le transporteur.
                  </li>
                  <li>
                    <b>Résolution :</b> indiquez le résultat final du litige (par exemple une
                    fraude), les montants, puis classez-le avéré ou non avéré avec un motif.
                  </li>
                  <li>
                    <b>Admin :</b> suivez les analyses et réglez les paramètres (agents, types de
                    litiges, délais, avoirs).
                  </li>
                </ol>
                <a className="guide-link" href={GUIDE_URL} target="_blank" rel="noopener">
                  <BookOpen size={17} />
                  <span>
                    <b>Ouvrir le guide complet</b>
                    <small>Pas à pas par service, avec des captures d’écran</small>
                  </span>
                  <ArrowUpRight size={15} />
                </a>
                {DEMO_ENABLED && (
                  <p>
                    La démonstration contient des données fictives. L’espace réel utilise des
                    comptes identifiés et une base partagée.
                  </p>
                )}
                <button className="primary" onClick={() => setModal('')}>
                  C’est parti
                  <ArrowUpRight size={15} />
                </button>
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Kpi({ label, value, icon, foot, accent, onClick }: KpiProps) {
  return (
    <button
      type="button"
      className="kpi"
      onClick={onClick}
      aria-label={label + ' : ' + value + ' · Voir les dossiers concernés'}
    >
      <div className="kpi-top">
        <span>{label}</span>
        <span className={'kpi-icon ' + accent}>{icon}</span>
      </div>
      <strong className={String(value).length > 9 ? 'kpi-long' : undefined}>{value}</strong>
      <small>{foot}</small>
      <span className="kpi-link">
        Voir les dossiers <ChevronRight size={13} />
      </span>
    </button>
  );
}

// Fiche dossier (responsables) : contentieux reliés, contentieux de la même commande à relier,
// et ouverture d'un contentieux depuis le dossier
function DossierContentieux({
  record,
  list,
  busy,
  onOpen,
  onLink,
}: {
  record: Dossier;
  list: Contentieux[];
  busy: boolean;
  onOpen: (focus: ContentieuxFocus) => void;
  onLink: (c: Contentieux, accept: boolean) => void;
}) {
  const linkedCt = list.filter((c) => c.dossierId === record.id);
  const proposed = list.filter((c) => !c.dossierId && matchingDossiers(c, [record]).length > 0);
  return (
    <div className="ct-dossier" role="group" aria-label="Contentieux">
      <div className="ct-dossier-head">
        <Scale size={16} />
        <b>Contentieux</b>
        <button type="button" className="text-btn" onClick={() => onOpen({ from: record })}>
          Ouvrir un contentieux
        </button>
      </div>
      {linkedCt.map((c) => (
        <p key={c.id}>
          <button type="button" className="text-btn" onClick={() => onOpen({ id: c.id })}>
            {c.ref}
          </button>{' '}
          · {contentieuxSummary(c)}
        </p>
      ))}
      {proposed.map((c) => (
        <div key={c.id} className="ct-link-box">
          <Link2 size={16} />
          <div>
            <b>
              Le contentieux {c.ref} concerne la même commande ({c.order})
            </b>
            <small>
              {contentieuxSummary(c)}
              {c.subSubject ? ' · ' + c.subSubject : ''}
            </small>
            <span className="ct-link-actions">
              <button
                type="button"
                className="primary small-btn"
                disabled={busy}
                onClick={() => onLink(c, true)}
              >
                <Check size={14} /> Relier à ce dossier
              </button>
              <button
                type="button"
                className="secondary small-btn"
                disabled={busy}
                onClick={() => onLink(c, false)}
              >
                Ce n’est pas le même
              </button>
            </span>
          </div>
        </div>
      ))}
      {!linkedCt.length && !proposed.length && <small>Aucun contentieux relié à ce dossier.</small>}
    </div>
  );
}
