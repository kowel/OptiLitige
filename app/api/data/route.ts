import { env } from '../../server/env';
import { moveToTrash } from '../../server/file-store';
import { sameOrigin } from '../../server/origin';
import { signInHref, signOutHref } from '../../auth';
import {
  ACCESS_LOG_PREFIX,
  context,
  failure,
  logAccess,
  out,
  outStream,
  settingsByPrefix,
  updateRecord,
} from '../context';
import {
  brands,
  products,
  outcomes,
  disputeTypes,
  carriers,
  stores,
  STORE_BRAND,
} from '../../catalogs';
import { CARRIER_DECISIONS } from '../../carrier-tracking.mjs';
import { claimImported } from '../../claim-imported.mjs';
import { canFlagImpatience, setImpatience } from '../../impatience.mjs';
import { closedDay, closedDayError, closedFromDay } from '../../closing-date.mjs';
import { syncWtShipments, wtSyncState } from '../welcometrack-store';
import { WT_SHIPMENTS_KEY, normalizeAlertId } from '../../welcometrack.mjs';
import { applyInfoEdit, changesText } from '../../edit-info.mjs';
import { normalizePrefs } from '../../user-prefs.mjs';
import {
  DEFAULT_BRAND_COLORS,
  DEFAULT_STAGES,
  LIST_DEFS,
  normalizeBrandColors,
  normalizeListUpdate,
  renameText,
} from '../../list-settings.mjs';
import { DEFAULT_AMOUNT_ALERTS, normalizeAmountAlerts } from '../../advanced-filters.mjs';
import { DEFAULT_REPEAT_ALERTS, normalizeRepeatAlerts } from '../../repeat-customer.mjs';
import { DEFAULT_CLAIM_TEMPLATES, normalizeTemplates } from '../../claim-templates.mjs';
import { DEFAULT_SIGNATURES, normalizeSignatures } from '../../mail-signatures.mjs';
import { TRASH_SETTINGS_KEY, normalizeTrashSettings } from '../../trash-settings.mjs';
import { normalizeTrackingLinks, trackingLinksWithDefaults } from '../../parcel-tracking.mjs';
import { CLAIM_FORMS_KEY, normalizeClaimForms } from '../../claim-forms.mjs';
import {
  API_FIELDS,
  CARRIER_API_KEY,
  apiStatus,
  mergeSecrets,
  normalizeApiKeys,
  testConnection,
} from '../../tracking-providers.mjs';
import { toggleWatch, watchKey } from '../../watch.mjs';
import { addReminder, remindersKey, removeReminder } from '../../reminders.mjs';
import { applyBulk, normalizeBulk } from '../../bulk-actions.mjs';
import { normalizeReports } from '../../reports.mjs';
import {
  DEFAULT_CARRIER_DELAYS,
  nextFollowup,
  normalizeCarrierDelays,
} from '../../carrier-delays.mjs';
import { parisToday } from '../../reminders.mjs';
import { applyPrefill } from '../../prefill.mjs';
import { verdictOf } from '../../treatment-rules.mjs';
import { RELANCES_KEY, relanceRows } from '../../relances.mjs';
import { isPriorityType } from '../../alerts.mjs';
import {
  PROFILES_KEY,
  expandMembers,
  loadProfiles,
  normalizeProfiles,
  resolveMember,
} from '../profiles';
import { clientStages, imputations as IMPUTATIONS } from '../../followup';
import { creditIssuedStamp, creditToday, resolveCredit } from '../../credit.mjs';
import {
  DEFAULT_CONTENTIEUX_SETTINGS,
  applyContentieuxAction,
  applyContentieuxRenames,
  normalizeContentieuxSettings,
} from '../../contentieux.mjs';
import { DEFAULT_SLA, normalizeSla } from '../../sla.mjs';
import { ALERT_KEY_PATTERN } from '../../alerts.mjs';
import { applyViewAction, viewsKey } from '../../advanced-filters.mjs';
import {
  DEFAULT_CREDIT_SETTINGS,
  applyCreditAction,
  normalizeCreditSettings,
} from '../../credit-requests.mjs';
import type { CreditActionResult, Dossier, Member, RecordRow, SettingRow } from '../../types';
import { ROLES, isAdmin, treatsDisputes } from '../../roles.mjs';
import { stampMilestones } from '../../delays.mjs';

// Contentieux (espace réservé aux admins), rangés dans settings : « contentieux:<id> »
const CONTENTIEUX_PREFIX = 'contentieux:';
const CONTENTIEUX_SETTINGS_KEY = 'contentieux-settings';

// Corps de requête JSON envoyé par le navigateur : non fiable, chaque champ utilisé est
// vérifié un par un ci-dessous avant d'être enregistré.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untrusted = any;
// Ligne de la liste allégée (LIST_SQL) : dossier sans les champs lourds + commentaires utiles
interface ListRow {
  payload: string;
  version: number;
  comments: string | null;
  activity: string | null;
}
export const dynamic = 'force-dynamic';
// Import des expéditions Welcometrack (alerte de plusieurs milliers de lignes, page par page)
export const maxDuration = 300;
const TYPES = disputeTypes;
const STATUSES = ['Nouveau', 'Pris en charge', 'En attente RC', 'Résolu', 'Réouvert'];
// Champs lourds retirés de la liste : ils ne servent qu'à l'écran de détail d'un dossier,
// chargé à part avec GET /api/data?id=… (voir LIST_SQL et la branche `id` de GET).
const LIST_SQL = `WITH r AS MATERIALIZED (
  -- Chaque dossier est lu une seule fois comme JSON (PostgreSQL relirait le texte à chaque
  -- « payload::jsonb »). Listes absentes ou nulles traitées comme vides : un dossier mal formé
  -- ne doit jamais empêcher l'affichage de la liste.
  SELECT id, version, payload::jsonb AS p FROM records
)
SELECT
  -- Description saisie à la création : 400 premiers caractères (récapitulatif au survol)
  ((r.p - 'sourceData' - 'history' - 'transportMessages' - 'description' - 'comments')
    || jsonb_build_object('descriptionShort', substr(COALESCE(r.p->>'description', ''), 1, 400)))::text AS payload,
  r.version,
  -- Dossiers suivis par l'agent (settings « watch:<e-mail> ») : dernière modification et dernier
  -- message, pour les notifications « Abonnements » (app/watch.mjs)
  CASE WHEN r.id IN (SELECT w->>'id' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE((SELECT payload FROM settings WHERE id = ?2), '[]')::jsonb) = 'array' THEN COALESCE((SELECT payload FROM settings WHERE id = ?2), '[]')::jsonb ELSE '[]'::jsonb END) w)
  THEN jsonb_build_object(
    'history', (SELECT jsonb_build_object('date', h.v->>'date', 'author', h.v->>'author', 'text', substr(h.v->>'text', 1, 200))
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.p->'history') = 'array' THEN r.p->'history' ELSE '[]'::jsonb END) WITH ORDINALITY h(v, k)
       ORDER BY h.v->>'date' DESC NULLS LAST, h.k DESC LIMIT 1),
    'comment', (SELECT jsonb_build_object('date', c.v->>'date', 'author', c.v->>'author', 'email', c.v->>'email', 'text', substr(c.v->>'text', 1, 200))
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.p->'comments') = 'array' THEN r.p->'comments' ELSE '[]'::jsonb END) WITH ORDINALITY c(v, k)
       ORDER BY c.v->>'date' DESC NULLS LAST, c.k DESC LIMIT 1))::text
  END AS activity,
  (SELECT COALESCE(jsonb_agg(c.v ORDER BY c.k), '[]'::jsonb)::text
     FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.p->'comments') = 'array' THEN r.p->'comments' ELSE '[]'::jsonb END) WITH ORDINALITY c(v, k)
     WHERE c.v->>'email' = ?1
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(c.v->'mentions') = 'array' THEN c.v->'mentions' ELSE '[]'::jsonb END) m WHERE m = ?1)) AS comments
FROM r`;
export async function GET(req: Request) {
  try {
    const { db, member, reader, profileMap } = await context();
    const id = new URL(req.url).searchParams.get('id');
    // Analyse des relances au Service Litige (app/relances.mjs) : réservée aux admins, calculée ici
    // pour que les textes des commentaires ne partent jamais vers les autres comptes
    if (new URL(req.url).searchParams.get('part') === 'relances') {
      if (member.role !== 'Admin') return out({ error: 'Accès admin requis' }, 403);
      const [recs, people, hist] = await Promise.all([
        db
          .prepare(
            "SELECT id, payload::jsonb->>'ref' AS ref, (payload::jsonb->'comments')::text AS comments, (payload::jsonb->'impatienceLog')::text AS impatience FROM records",
          )
          .all<{ id: string; ref: string; comments: string | null; impatience: string | null }>(),
        db.prepare('SELECT email, name, role FROM members').all<Member>(),
        db
          .prepare('SELECT payload FROM settings WHERE id=?')
          .bind(RELANCES_KEY)
          .first<SettingRow>(),
      ]);
      const records = recs.results.map((r) => ({
        id: r.id,
        ref: r.ref,
        comments: JSON.parse(r.comments || '[]'),
        impatienceLog: JSON.parse(r.impatience || '[]'),
      }));
      const history = hist ? JSON.parse(hist.payload) : {};
      return out({ rows: relanceRows(records, people.results, history) });
    }
    if (id !== null) {
      if (!id || id.length > 200) return out({ error: 'Dossier invalide.' }, 400);
      // Échanges en direct (app/live-comments.ts) : seulement les commentaires, requête légère
      if (new URL(req.url).searchParams.get('part') === 'comments') {
        const live = await db
          .prepare(
            "SELECT (payload::jsonb->'comments')::text AS comments, version FROM records WHERE id=?",
          )
          .bind(id)
          .first<{ comments: string | null; version: number }>();
        if (!live) return out({ error: 'Dossier introuvable' }, 404);
        return out({ comments: JSON.parse(live.comments || '[]'), version: live.version });
      }
      const row = await db
        .prepare('SELECT payload, version FROM records WHERE id=?')
        .bind(id)
        .first<RecordRow>();
      if (!row) return out({ error: 'Dossier introuvable' }, 404);
      return out({ record: { ...JSON.parse(row.payload), version: row.version } });
    }
    const prefix = 'notification-read:' + reader + ':';
    const alertPrefix = 'alert-read:' + reader + ':';
    const isAdmin = member.role === 'Admin';
    // Réglages d'une seule ligne : lus en une requête (au lieu d'une vingtaine d'allers-retours
    // avec la base, chacun de 30 à 60 ms en ligne)
    const one = {
      config: 'types',
      catalog: 'catalogs',
      sla: 'sla',
      creditSettings: 'credit-settings',
      views: viewsKey(member.role),
      shipments: 'shipments',
      amountAlerts: 'amount-alerts',
      repeatAlerts: 'repeat-alerts',
      claimTemplates: 'claim-templates',
      reports: 'reports',
      brandColors: 'brand-colors',
      prefs: 'prefs:' + String(member.email).toLowerCase(),
      trackingLinks: 'tracking-links',
      claimForms: CLAIM_FORMS_KEY,
      watching: watchKey(member.email),
      reminders: remindersKey(member.email),
      carrierDelays: 'carrier-delays',
      mailSignatures: 'mail-signatures',
      contentieuxSettings: isAdmin ? CONTENTIEUX_SETTINGS_KEY : '',
      carrierApiRow: isAdmin ? CARRIER_API_KEY : '',
      wtSyncRow: isAdmin ? WT_SHIPMENTS_KEY : '',
      trashSettings: isAdmin ? TRASH_SETTINGS_KEY : '',
    };
    const none = Promise.resolve({ results: [] as { id: string; payload: string }[] });
    const [rows, agents, singles, reads, accessLog, alertReads, contentieuxRows] =
      await Promise.all([
        // Seuls les commentaires écrits par l'agent ou qui le mentionnent sont gardés :
        // ce sont les seuls utiles au calcul de ses notifications (app/notifications.mjs).
        db
          .prepare(LIST_SQL)
          .bind(String(member.email).toLowerCase(), watchKey(member.email))
          .all<ListRow>(),
        // Ordre stable (PostgreSQL ne garde pas l'ordre d'insertion)
        db.prepare('SELECT * FROM members ORDER BY name, email').all(),
        db
          .prepare(
            'SELECT id, payload FROM settings WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))',
          )
          .bind(JSON.stringify(Object.values(one).filter(Boolean)))
          .all<{ id: string; payload: string }>(),
        settingsByPrefix(db, prefix),
        // Journal des accès : réservé aux admins, 300 dernières lignes
        isAdmin ? settingsByPrefix(db, ACCESS_LOG_PREFIX, 300) : none,
        settingsByPrefix(db, alertPrefix),
        // Espace Contentieux : réservé aux admins
        isAdmin ? settingsByPrefix(db, CONTENTIEUX_PREFIX) : none,
      ]);
    const byId = new Map(singles.results.map((r) => [r.id, r]));
    const setting = (key: keyof typeof one): SettingRow | null =>
      (one[key] && byId.get(one[key])) || null;
    const config = setting('config'),
      catalog = setting('catalog'),
      sla = setting('sla'),
      creditSettings = setting('creditSettings'),
      views = setting('views'),
      shipments = setting('shipments'),
      amountAlerts = setting('amountAlerts'),
      repeatAlerts = setting('repeatAlerts'),
      claimTemplates = setting('claimTemplates'),
      reports = setting('reports'),
      brandColors = setting('brandColors'),
      prefs = setting('prefs'),
      trackingLinks = setting('trackingLinks'),
      claimForms = setting('claimForms'),
      watching = setting('watching'),
      reminders = setting('reminders'),
      carrierDelays = setting('carrierDelays'),
      mailSignatures = setting('mailSignatures');
    const shipmentData = shipments ? JSON.parse(shipments.payload) : null;
    return outStream({
      signIn: signInHref(),
      signOut: signOutHref(),
      readNotificationIds: reads.results.map((r) => JSON.parse(r.payload).key),
      accessLog: accessLog.results.map((r) => JSON.parse(r.payload)),
      // Espace Contentieux : réservé aux admins
      ...(member.role === 'Admin'
        ? {
            contentieux: contentieuxRows.results
              .map((r) => JSON.parse(r.payload))
              .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt))),
            contentieuxSettings:
              JSON.parse(setting('contentieuxSettings')?.payload || 'null') ||
              DEFAULT_CONTENTIEUX_SETTINGS,
          }
        : {}),
      readAlertKeys: alertReads.results.map((r) => JSON.parse(r.payload).key),
      catalogs: {
        brands,
        products,
        outcomes,
        carriers,
        stores,
        ...DEFAULT_STAGES,
        ...(catalog ? JSON.parse(catalog.payload) : {}),
      },
      me: member,
      records: rows.results.map((r) => ({
        ...JSON.parse(r.payload),
        comments: JSON.parse(r.comments || '[]'),
        ...(r.activity ? { activity: JSON.parse(r.activity) } : {}),
        version: r.version,
        lite: true,
      })),
      // Adresses partagées : un agent par profil (mentions, attribution, demandeur)
      members: expandMembers(agents.results as unknown as Member[], profileMap),
      // Adresses de connexion et profils déclarés par adresse (Équipe & accès) : réservés aux
      // responsables ; les autres agents n'ont que la liste ci-dessus (noms pour les mentions)
      ...(member.role === 'Admin' ? { accounts: agents.results, memberProfiles: profileMap } : {}),
      // Connexions aux API des transporteurs : état seulement (jamais les clés), responsables
      ...(member.role === 'Admin'
        ? {
            carrierApis: apiStatus(env, JSON.parse(setting('carrierApiRow')?.payload || '{}')),
            // Expéditions lues sur l'alerte Welcometrack : n° de l'alerte, dernier import
            welcometrackSync: JSON.parse(setting('wtSyncRow')?.payload || '{"alertId":""}'),
          }
        : {}),
      types: config ? JSON.parse(config.payload) : TYPES,
      sla: sla ? JSON.parse(sla.payload) : DEFAULT_SLA,
      creditSettings: creditSettings ? JSON.parse(creditSettings.payload) : DEFAULT_CREDIT_SETTINGS,
      // Vues enregistrées du service de l'agent (partagées par tous les comptes du même rôle)
      savedViews: views ? JSON.parse(views.payload) : [],
      // Expéditions par mois et par transporteur (ratio litiges / expéditions)
      shipments: shipmentData?.months || {},
      shipmentsInfo: shipmentData?.info || null,
      // Seuils des contours orangé / rouge de la liste (Paramètres → Repères de montant)
      amountAlerts: amountAlerts ? JSON.parse(amountAlerts.payload) : DEFAULT_AMOUNT_ALERTS,
      // Alerte client récidiviste (Paramètres)
      repeatAlerts: repeatAlerts ? JSON.parse(repeatAlerts.payload) : DEFAULT_REPEAT_ALERTS,
      // Modèles de réclamation transporteur (onglet Transporteur)
      claimTemplates: claimTemplates ? JSON.parse(claimTemplates.payload) : DEFAULT_CLAIM_TEMPLATES,
      // Rapports programmés (Paramètres → Rapports programmés)
      reports: reports ? JSON.parse(reports.payload) : [],
      // Délais des relances transporteur (Paramètres)
      carrierDelays: carrierDelays ? JSON.parse(carrierDelays.payload) : DEFAULT_CARRIER_DELAYS,
      // Signatures des e-mails de l'onglet Transporteur (Paramètres → Signatures d'e-mail)
      mailSignatures: mailSignatures ? JSON.parse(mailSignatures.payload) : DEFAULT_SIGNATURES,
      // Corbeille des pièces jointes (Paramètres, admins) : vidage automatique désactivé par défaut
      ...(isAdmin
        ? {
            trashSettings: normalizeTrashSettings(
              JSON.parse(setting('trashSettings')?.payload || 'null'),
            ),
          }
        : {}),
      // Couleurs des enseignes (Paramètres → Enseignes)
      brandColors: brandColors ? JSON.parse(brandColors.payload) : DEFAULT_BRAND_COLORS,
      // Préférences d'affichage du compte (formats et disposition des graphiques)
      prefs: prefs ? JSON.parse(prefs.payload) : { charts: {}, layouts: {} },
      // Adresses de suivi des colis par transporteur (Paramètres → Liens de suivi)
      trackingLinks: trackingLinksWithDefaults(
        trackingLinks ? JSON.parse(trackingLinks.payload) : null,
      ),
      claimForms: claimForms ? JSON.parse(claimForms.payload) : {},
      // Dossiers suivis par l'agent (bouton « Suivre ce dossier »)
      watching: watching ? JSON.parse(watching.payload) : [],
      // Rappels personnels (« Me rappeler le… »)
      reminders: reminders ? JSON.parse(reminders.payload) : [],
    });
  } catch (e) {
    return failure(e);
  }
}
// Conclusion d'un dossier importé : jamais reprise telle quelle de la requête. Déduite du résultat
// quand il est connu, sinon limitée aux valeurs prévues
const IMPORT_VERDICTS = ['Avéré', 'Non avéré', 'Non renseigné (import)'];
function importedResolution(x: { outcome?: unknown; resolution?: unknown }) {
  const res = x.resolution as { verdict?: string; reason?: unknown } | null | undefined;
  if (!res || typeof res !== 'object') return null;
  const outcome = String(x.outcome || '').trim();
  const reason = String(res.reason || '').slice(0, 1000);
  if (outcome) return { verdict: verdictOf(outcome), reason: reason || outcome.slice(0, 1000) };
  const verdict = IMPORT_VERDICTS.includes(String(res.verdict))
    ? String(res.verdict)
    : 'Non renseigné (import)';
  return { verdict, reason };
}
// File des e-mails à envoyer (« mail-outbox ») : l'envoi par Microsoft 365 n'est pas encore
// branché (A-FINALISER-AVEC-IT.md) ; les messages attendent ici, 500 au plus
async function queueMail(
  db: D1Database,
  mail: { to: string[]; subject: string; text: string; record?: string; at: string },
) {
  await updateUserList(db, 'mail-outbox', (list) => ({
    list: [...list, { ...mail, status: 'à envoyer' }].slice(-500),
  }));
}
// Liste propre à un agent (dossiers suivis, rappels) : relue puis réécrite seulement si elle n'a
// pas changé entre-temps (deux onglets ouverts), sinon on recommence
async function updateUserList(
  db: D1Database,
  key: string,
  change: (list: unknown[]) => { list?: unknown[]; error?: string },
): Promise<{ list?: unknown[]; error?: string; status?: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db
      .prepare('SELECT payload FROM settings WHERE id=?')
      .bind(key)
      .first<SettingRow>();
    const result = change(row ? JSON.parse(row.payload) : []);
    if (result.error) return { error: result.error };
    const saved = row
      ? await db
          .prepare('UPDATE settings SET payload=? WHERE id=? AND payload=?')
          .bind(JSON.stringify(result.list), key, row.payload)
          .run()
      : await db
          .prepare('INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT (id) DO NOTHING')
          .bind(key, JSON.stringify(result.list))
          .run();
    if (saved.meta.changes) return { list: result.list };
  }
  return { error: 'Réessayez dans un instant.', status: 409 };
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return out({ error: 'Origine non autorisée' }, 403);
    const { db, member, user, reader } = await context();
    // Adresse partagée : on agit toujours au nom d'un profil (sinon tout partirait au nom de la boîte)
    if (member.profiles?.length && !member.profile)
      return out({ error: 'Choisissez d’abord votre profil (« Qui êtes-vous ? »).' }, 428);
    const b = (await req.json()) as Untrusted;
    const admin = isAdmin(member.role),
      litige = treatsDisputes(member.role);
    if (b.action === 'member') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const email = String(b.email || '')
        .trim()
        .toLowerCase();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        ![...ROLES, 'Désactivé'].includes(b.role) ||
        !String(b.name || '').trim()
      )
        return out({ error: 'Vérifiez le nom, l’adresse et le service.' }, 400);
      if (email === user.email.toLowerCase() && b.role !== 'Admin')
        return out({ error: 'Conservez votre accès admin.' }, 400);
      const name = String(b.name).trim().slice(0, 100);
      const before = await db
        .prepare('SELECT name, role FROM members WHERE email=?')
        .bind(email)
        .first<Pick<Member, 'name' | 'role'>>();
      await db
        .prepare(
          'INSERT INTO members(email,name,role) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role',
        )
        .bind(email, name, b.role)
        .run();
      if (!before || before.role !== b.role || before.name !== name)
        await logAccess(db, {
          by: member.email,
          byName: member.name,
          email,
          before: before ? { name: before.name, role: before.role } : null,
          after: { name, role: b.role },
        });
      // Compte actif : ses dossiers repris de SharePoint (demandeur connu par son seul nom) lui
      // sont rattachés, pour qu'il les retrouve dans « Mes dossiers »
      let claimed = 0;
      if (b.role !== 'Désactivé') {
        const imported = (
          await db
            .prepare(
              `SELECT id, payload, version FROM records
               WHERE payload::jsonb->>'importedAt' IS NOT NULL
                 AND COALESCE(payload::jsonb->>'requesterEmail', '') = ''`,
            )
            .all<{ id: string; payload: string; version: number }>()
        ).results;
        const updates = imported.flatMap((row) => {
          const next = claimImported(JSON.parse(row.payload), { email, name }, member.name);
          return next
            ? [
                db
                  .prepare(
                    'UPDATE records SET payload=?,version=version+1 WHERE id=? AND version=?',
                  )
                  .bind(JSON.stringify(next), row.id, row.version),
              ]
            : [];
        });
        if (updates.length)
          claimed = (await db.batch(updates)).reduce((n, x) => n + (x.meta.changes || 0), 0);
      }
      return out({ ok: true, claimed });
    }
    if (member.role === 'Désactivé') return out({ error: 'Compte désactivé' }, 403);
    if (b.action === 'catalogs') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const c = b.catalogs;
      if (c && !c.stores) c.stores = stores;
      const previous = await db
        .prepare('SELECT payload FROM settings WHERE id=?')
        .bind('catalogs')
        .first<SettingRow>();
      for (const k of ['brands', 'products', 'outcomes', 'carriers', 'stores'])
        if (
          !c ||
          !Array.isArray(c[k]) ||
          !c[k].length ||
          c[k].length > 50 ||
          c[k].some((v) => typeof v !== 'string' || !v.trim() || v.length > 120)
        )
          return out({ error: 'Listes invalides (1 à 50 valeurs non vides).' }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind(
          'catalogs',
          JSON.stringify({
            ...(previous ? JSON.parse(previous.payload) : {}),
            brands: c.brands,
            products: c.products,
            outcomes: c.outcomes,
            carriers: c.carriers,
            stores: c.stores,
          }),
        )
        .run();
      return out({ ok: true });
    }
    // Vues partagées par service : ajout ou suppression d'une vue à la fois, en relisant la
    // liste actuelle (deux collègues peuvent enregistrer une vue en même temps)
    if (b.action === 'view-add' || b.action === 'view-delete') {
      const key = viewsKey(member.role);
      for (let attempt = 0; attempt < 3; attempt++) {
        const row = await db
          .prepare('SELECT payload FROM settings WHERE id=?')
          .bind(key)
          .first<SettingRow>();
        const result = applyViewAction(
          row ? JSON.parse(row.payload) : [],
          b,
          member,
          new Date().toISOString(),
          'vue-' + crypto.randomUUID().slice(0, 8),
        );
        if (result.error) return out({ error: result.error }, 400);
        const saved = row
          ? await db
              .prepare('UPDATE settings SET payload=? WHERE id=? AND payload=?')
              .bind(JSON.stringify(result.views), key, row.payload)
              .run()
          : await db
              .prepare('INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT (id) DO NOTHING')
              .bind(key, JSON.stringify(result.views))
              .run();
        if (saved.meta.changes) return out({ ok: true, message: result.message });
      }
      return out({ error: 'Réessayez dans un instant.' }, 409);
    }
    if (b.action === 'credit-settings') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const { settings, error } = normalizeCreditSettings(b.settings);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('credit-settings', JSON.stringify(settings))
        .run();
      return out({ ok: true });
    }
    // Listes métier (Paramètres) : nouvelle liste, renommages éventuels dans les anciens
    // dossiers, couleurs des enseignes
    // Préférences d'affichage du compte connecté (tout service)
    if (b.action === 'prefs') {
      const { prefs, error } = normalizePrefs(b.prefs);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('prefs:' + String(member.email).toLowerCase(), JSON.stringify(prefs))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'list-update') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const key = String(b.list || '');
      const def = (LIST_DEFS as Record<string, { label: string; field: string }>)[key];
      if (!def) return out({ error: 'Liste inconnue.' }, 400);
      const [typesRow, catalogRow] = await Promise.all([
        db.prepare('SELECT payload FROM settings WHERE id=?').bind('types').first<SettingRow>(),
        db.prepare('SELECT payload FROM settings WHERE id=?').bind('catalogs').first<SettingRow>(),
      ]);
      const stored = catalogRow ? JSON.parse(catalogRow.payload) : {};
      const current: Record<string, string[]> = {
        brands,
        products,
        outcomes,
        carriers,
        stores,
        ...DEFAULT_STAGES,
        ...stored,
        types: typesRow ? JSON.parse(typesRow.payload) : TYPES,
      };
      const { values, renames, error } = normalizeListUpdate(
        key,
        b.values,
        b.renames,
        current[key],
      );
      if (error) return out({ error }, 400);
      const save = (id: string, payload: unknown) =>
        db
          .prepare(
            'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
          )
          .bind(id, JSON.stringify(payload));
      const statements = [
        key === 'types' ? save('types', values) : save('catalogs', { ...stored, [key]: values }),
      ];
      if (key === 'brands' && b.colors)
        statements.push(save('brand-colors', normalizeBrandColors(b.colors, values!)));
      // Renommer aussi la valeur dans les anciens dossiers (avec une ligne d'historique)
      if (b.applyToRecords)
        for (const { from, to } of renames!)
          statements.push(
            db
              .prepare(
                `UPDATE records SET version=version+1,
                   payload=(jsonb_set(payload::jsonb || jsonb_build_object('history', COALESCE(payload::jsonb->'history', '[]'::jsonb) || jsonb_build_array(?::jsonb)),
                     '{${def.field}}', to_jsonb(?::text))
                     || jsonb_build_object('rev', COALESCE((payload::jsonb->>'rev')::int, 0) + 1))::text
                 WHERE payload::jsonb->>'${def.field}' = ?::text`,
              )
              .bind(
                JSON.stringify({
                  date: new Date().toISOString(),
                  text: renameText(key, from, to),
                  author: member.name,
                }),
                to,
                from,
              ),
          );
      const results = await db.batch(statements);
      const renamed = b.applyToRecords
        ? results
            .slice(statements.length - renames!.length)
            .reduce((n, x) => n + (x.meta.changes || 0), 0)
        : 0;
      return out({ ok: true, renamed });
    }
    // Adresse partagée par plusieurs personnes : profils choisis à la connexion (responsables)
    if (b.action === 'member-profiles') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const email = String(b.email || '')
        .trim()
        .toLowerCase();
      const exists = await db
        .prepare('SELECT email FROM members WHERE email=?')
        .bind(email)
        .first();
      if (!exists) return out({ error: 'Agent introuvable.' }, 400);
      const { profiles, error } = normalizeProfiles(b.profiles);
      if (error) return out({ error }, 400);
      const map = await loadProfiles(db);
      if (profiles!.length) map[email] = profiles!;
      else delete map[email];
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind(PROFILES_KEY, JSON.stringify(map))
        .run();
      await logAccess(db, {
        by: member.email,
        byName: member.name,
        email,
        before: null,
        after: null,
        note: profiles!.length
          ? 'Profils sur cette adresse : ' + profiles!.join(', ')
          : 'Profils retirés de cette adresse',
      });
      return out({ ok: true, profiles });
    }
    // Connexions aux API des transporteurs (Paramètres → Connexions transporteurs)
    if (
      b.action === 'carrier-api-keys' ||
      b.action === 'carrier-api-remove' ||
      b.action === 'carrier-api-test'
    ) {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const provider = String(b.provider || '');
      if (!(provider in API_FIELDS)) return out({ error: 'Transporteur inconnu.' }, 400);
      const row = await db
        .prepare('SELECT payload FROM settings WHERE id=?')
        .bind(CARRIER_API_KEY)
        .first<SettingRow>();
      const stored = row ? JSON.parse(row.payload) : {};
      if (b.action === 'carrier-api-test') {
        // Valeurs saisies (pas encore enregistrées), sinon celles déjà réglées
        let secrets = mergeSecrets(env, stored);
        if (b.values) {
          const { values, error } = normalizeApiKeys(provider, b.values);
          if (error) return out({ error }, 400);
          secrets = { ...secrets, ...values };
        }
        return out(await testConnection(provider, secrets));
      }
      if (b.action === 'carrier-api-keys') {
        const { values, error } = normalizeApiKeys(provider, b.values);
        if (error) return out({ error }, 400);
        stored[provider] = { values, savedAt: new Date().toISOString(), savedBy: member.name };
      } else delete stored[provider];
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind(CARRIER_API_KEY, JSON.stringify(stored))
        .run();
      return out({ ok: true });
    }
    // Expéditions Welcometrack (Paramètres → Expéditions) : n° de l'alerte interne, puis import
    if (b.action === 'welcometrack-alert' || b.action === 'welcometrack-sync') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      if (b.action === 'welcometrack-alert') {
        const { alertId, error } = normalizeAlertId(b.alertId);
        if (error) return out({ error }, 400);
        const state = await wtSyncState(db);
        await db
          .prepare(
            'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
          )
          .bind(WT_SHIPMENTS_KEY, JSON.stringify({ ...state, alertId }))
          .run();
        return out({ ok: true });
      }
      const keys = await db
        .prepare('SELECT payload FROM settings WHERE id=?')
        .bind(CARRIER_API_KEY)
        .first<SettingRow>();
      const secrets = mergeSecrets(env, keys ? JSON.parse(keys.payload) : {});
      const catalogRow = await db
        .prepare('SELECT payload FROM settings WHERE id=?')
        .bind('catalogs')
        .first<SettingRow>();
      const ours = (catalogRow ? JSON.parse(catalogRow.payload).carriers : null) || carriers;
      const result = await syncWtShipments(db, secrets.WELCOMETRACK_API_KEY, ours, member.name);
      if (!result.ok) return out({ error: result.message }, 400);
      return out({ ok: true, message: result.message });
    }
    if (b.action === 'claim-forms') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const { forms, error } = normalizeClaimForms(b.forms);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind(CLAIM_FORMS_KEY, JSON.stringify(forms))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'tracking-links') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const { links, error } = normalizeTrackingLinks(b.links);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('tracking-links', JSON.stringify(links))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'carrier-delays') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const { delays, error } = normalizeCarrierDelays(b.delays);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('carrier-delays', JSON.stringify(delays))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'reports') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const people = await db.prepare('SELECT email FROM members').all<{ email: string }>();
      const { reports, error } = normalizeReports(
        b.reports,
        people.results.map((p) => p.email),
      );
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('reports', JSON.stringify(reports))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'trash-settings') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const settings = normalizeTrashSettings(b.settings);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind(TRASH_SETTINGS_KEY, JSON.stringify(settings))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'mail-signatures') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const { signatures, error } = normalizeSignatures(b.signatures);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('mail-signatures', JSON.stringify(signatures))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'claim-templates') {
      if (!treatsDisputes(member.role))
        return out({ error: 'Réservé au Service Litige, aux Responsables et aux Admins' }, 403);
      const { templates, error } = normalizeTemplates(b.templates);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('claim-templates', JSON.stringify(templates))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'repeat-alerts') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const { alerts, error } = normalizeRepeatAlerts(b.alerts);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('repeat-alerts', JSON.stringify(alerts))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'amount-alerts') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const { alerts, error } = normalizeAmountAlerts(b.alerts);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('amount-alerts', JSON.stringify(alerts))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'sla') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const { rules, error } = normalizeSla(b.sla);
      if (error) return out({ error }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('sla', JSON.stringify(rules))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'types') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const t = b.types;
      if (
        !Array.isArray(t) ||
        !t.length ||
        t.length > 30 ||
        t.some((v) => typeof v !== 'string' || !v.trim() || v.length > 100)
      )
        return out({ error: 'Saisissez entre 1 et 30 types valides.' }, 400);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('types', JSON.stringify([...new Set(t)]))
        .run();
      return out({ ok: true });
    }
    const now = new Date().toISOString();
    // Reprise des commentaires d'un dossier importé (export SharePoint, scripts/sharepoint) :
    // auteur et date d'origine conservés ; un commentaire déjà repris (même sourceKey) est ignoré
    if (b.action === 'import-comments') {
      if (!admin) return out({ error: 'Reprise réservée aux admins.' }, 403);
      const list = b.comments;
      if (!Array.isArray(list) || !list.length || list.length > 500)
        return out({ error: 'Lot de commentaires invalide (500 au maximum).' }, 400);
      for (const c of list)
        if (
          !c ||
          !/^[\w:.-]{1,120}$/.test(String(c.sourceKey || '')) ||
          !Number.isFinite(Date.parse(c.date)) ||
          typeof c.text !== 'string' ||
          c.text.length > 20000
        )
          return out({ error: 'Commentaire repris invalide.' }, 400);
      let added = 0,
        updated = 0;
      // Texte encodé par SharePoint (« &#123; », « &quot; »…) : décodé
      const entities: Record<string, string> = {
        quot: '"',
        amp: '&',
        lt: '<',
        gt: '>',
        apos: "'",
        nbsp: ' ',
      };
      const decode = (v: string) =>
        v.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) =>
          e[0] === '#'
            ? String.fromCodePoint(
                e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)),
              )
            : (entities[e.toLowerCase()] ?? m),
        );
      const clean = (c: Untrusted) => decode(String(c.text)).trim() || '(commentaire vide)';
      const refused = await updateRecord(db, String(b.id || ''), (r) => {
        added = 0;
        updated = 0;
        if (!r.sourceList) return out({ error: 'Ce dossier ne vient pas d’un import.' }, 400);
        const known = new Map(
          (r.comments || []).filter((c) => c.sourceKey).map((c) => [c.sourceKey, c]),
        );
        // Commentaire déjà repris dont le texte a changé (relecture après correction de
        // l'export, ex. noms des @mentions) : texte mis à jour
        for (const c of list) {
          const existing = known.get(c.sourceKey);
          if (existing && existing.text !== clean(c)) {
            existing.text = clean(c);
            updated++;
          }
        }
        const fresh = list
          .filter((c: Untrusted) => !known.has(c.sourceKey))
          .map((c: Untrusted) => ({
            id: crypto.randomUUID(),
            sourceKey: String(c.sourceKey),
            author: String(c.author || 'Inconnu').slice(0, 200) + ' (SharePoint)',
            email: String(c.email || '')
              .toLowerCase()
              .slice(0, 200),
            text: clean(c),
            date: new Date(c.date).toISOString(),
            mentions: [],
          }));
        added = fresh.length;
        // Rien de nouveau : le dossier n'est pas réécrit (sa version ne change pas)
        if (!added && !updated)
          return out({ ok: true, added: 0, updated: 0, skipped: list.length });
        if (!added) {
          r.history = [
            ...(r.history || []),
            {
              date: now,
              text: updated + ' commentaire(s) SharePoint mis à jour',
              author: member.name,
            },
          ];
          return;
        }
        r.comments = [...(r.comments || []), ...fresh].sort((x, y) =>
          String(x.date).localeCompare(String(y.date)),
        );
        r.history = [
          ...(r.history || []),
          {
            date: now,
            text: added + ' commentaire(s) repris de SharePoint',
            author: member.name,
          },
        ];
      });
      if (refused) return refused;
      return out({ ok: true, added, updated, skipped: list.length - added - updated });
    }
    if (b.action === 'import') {
      if (!admin) return out({ error: 'Import réservé aux admins.' }, 403);
      if (!Array.isArray(b.records) || !b.records.length || b.records.length > 50)
        return out({ error: 'Lot invalide (50 dossiers maximum).' }, 400);
      // Propriétaire d'un dossier importé : le demandeur, s'il a un compte dans l'outil
      // (nom identique, sans tenir compte des majuscules ni des accents) ; sinon l'importateur
      const fold = (v: unknown) =>
        String(v || '')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .trim()
          .toLowerCase();
      const accounts = (
        await db.prepare("SELECT name, email FROM members WHERE role!='Désactivé'").all<Member>()
      ).results;
      const accountOf = (name: unknown) =>
        accounts.find((m) => fold(m.name) === fold(name))?.email.toLowerCase() || '';
      const ownerOf = (name: unknown) => accountOf(name) || member.email;
      // Dossiers déjà repris sous un autre nom de liste (nom proposé à l'import différent de celui
      // de la première reprise) : même ID SharePoint et même date d'ouverture = déjà présent
      const sourceIds = [
        ...new Set(
          b.records.map((x: Untrusted) => String(x?.externalId || '').trim()).filter(Boolean),
        ),
      ] as string[];
      const known = new Set(
        sourceIds.length
          ? (
              await db
                .prepare(
                  "SELECT payload::jsonb->>'sourceId' AS s, payload::jsonb->>'created' AS c FROM records WHERE payload::jsonb->>'sourceId' IN (" +
                    sourceIds.map(() => '?::text').join(',') +
                    ')',
                )
                .bind(...sourceIds)
                .all<{ s: string; c: string }>()
            ).results.map((x) => x.s + '|' + x.c)
          : [],
      );
      const statements = [];
      for (const x of b.records) {
        if (
          !x ||
          !String(x.title || '').trim() ||
          String(x.title).length > 500 ||
          !STATUSES.includes(x.status) ||
          !['Transport', 'Interne'].includes(x.origin) ||
          !x.created ||
          !Number.isFinite(Date.parse(x.created)) ||
          !String(x.sourceList || '').trim() ||
          String(x.sourceList).length > 200 ||
          !x.sourceData ||
          typeof x.sourceData !== 'object' ||
          JSON.stringify(x.sourceData).length > 100000
        )
          return out(
            { error: 'Dossier importé invalide. Vérifiez la correspondance des colonnes.' },
            400,
          );
        for (const f of ['amount', 'credit', 'compensation'])
          if (typeof x[f] !== 'number' || !Number.isFinite(x[f]) || x[f] < 0)
            return out({ error: 'Montant importé invalide.' }, 400);
        for (const f of ['disputeValue', 'indemTps'])
          if (x[f] != null && (!Number.isFinite(Number(x[f])) || Number(x[f]) < 0))
            return out({ error: 'Montant de suivi importé invalide.' }, 400);
        for (const f of [
          'creditCreated',
          'takenAt',
          'carrierSentAt',
          'carrierResponseDue',
          'carrierReplyAt',
          'carrierFollowupAt',
        ])
          if (x[f] && !Number.isFinite(Date.parse(x[f])))
            return out({ error: 'Date de suivi importée invalide.' }, 400);
        if (x.closed && (!Number.isFinite(Date.parse(x.closed)) || x.closed < x.created))
          return out({ error: 'La clôture du dossier résolu est invalide.' }, 400);
        if (
          !Array.isArray(x.reopened) ||
          x.reopened.some((d: Untrusted) => !Number.isFinite(Date.parse(d)) || d < x.created) ||
          (x.status === 'Réouvert' && !x.reopened.length)
        )
          return out({ error: 'Dates de réouverture invalides.' }, 400);
        if (x.externalId && known.has(String(x.externalId).trim() + '|' + x.created)) continue;
        const key = x.sourceList + '|' + (x.externalId || JSON.stringify(x.sourceData));
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))),
        )
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
        const id = 'import-' + hash,
          history = [
            {
              date: x.created,
              text: 'Ouverture selon la source Microsoft Lists',
              author: 'Migration',
            },
          ];
        if (x.importedClosed)
          history.push({
            date: x.importedClosed,
            text: 'Clôture selon la source Microsoft Lists',
            author: 'Migration',
          });
        for (const d of x.reopened)
          history.push({
            date: d,
            text: 'Réouverture selon la source Microsoft Lists',
            author: 'Migration',
          });
        history.push({
          date: now,
          text:
            'Import depuis ' +
            String(b.fileName || 'Excel').slice(0, 200) +
            ' · statut repris : ' +
            x.status,
          author: member.name,
        });
        const r = {
          id,
          importedAt: now,
          importFile: String(b.fileName || 'Excel').slice(0, 200),
          ref: 'IMP-' + (String(x.externalId || '').slice(0, 60) || hash.slice(0, 7).toUpperCase()),
          title: x.title,
          customer: String(x.customer || 'Non renseigné (import)').slice(0, 200),
          order: String(x.order || 'Non renseigné (import)').slice(0, 200),
          amount: x.amount,
          type: String(x.type || 'Non classé (import)').slice(0, 200),
          origin: x.origin,
          carrier: String(x.carrier || '').slice(0, 200),
          priority: x.priority === 'Haute' ? 'Haute' : 'Normale',
          carrierDecision: CARRIER_DECISIONS.includes(x.carrierDecision) ? x.carrierDecision : '',
          status: x.status,
          created: x.created,
          closed: x.status === 'Résolu' ? x.closed : null,
          reopened: x.reopened,
          brand: String(x.brand || 'Non renseignée (import)').slice(0, 120),
          store: String(x.store || '').slice(0, 120),
          productType: String(x.productType || 'Non renseigné (import)').slice(0, 120),
          productRef: String(x.productRef || '').slice(0, 200),
          ticket: String(x.ticket || '').slice(0, 200),
          bt: String(x.bt || '').slice(0, 200),
          requester: String(x.requester || '').slice(0, 200),
          outcome: String(x.outcome || '').slice(0, 200),
          creditNumber: String(x.creditNumber || '').slice(0, 200),
          invoice: String(x.invoice || '').slice(0, 200),
          creditCreated: x.creditCreated || null,
          takenAt: x.takenAt || null,
          disputeValue: Number(x.disputeValue || 0),
          indemTps: Number(x.indemTps || 0),
          carrierStatus: String(x.carrierStatus || '').slice(0, 500),
          rcCheck: String(x.rcCheck || '').slice(0, 500),
          rcManager: String(x.rcManager || '').slice(0, 500),
          followUp: String(x.followUp || '').slice(0, 500),
          solco: String(x.solco || '').slice(0, 500),
          solution: String(x.solution || '').slice(0, 1000),
          compensationState: String(x.compensationState || '').slice(0, 500),
          carrierCaseRef: String(x.carrierCaseRef || '').slice(0, 200),
          clientStage: String(x.clientStage || 'Non renseignée (import)').slice(0, 200),
          carrierSentAt: x.carrierSentAt || null,
          carrierResponseDue: x.carrierResponseDue || null,
          carrierFollowupAt: x.carrierFollowupAt || null,
          carrierReplyAt: x.carrierReplyAt || null,
          transportMessages: [],
          creator: ownerOf(x.requester),
          // Demandeur rattaché à son compte s'il existe ; sinon à l'ajout du compte (action « member »)
          requesterEmail: accountOf(x.requester),
          importedBy: member.email,
          assignee: String(x.assignee || '').slice(0, 200),
          creditIssued: !!x.creditIssued || !!String(x.creditNumber || '').trim(),
          credit: x.credit,
          compensation: x.compensation,
          description: String(x.description || 'Dossier importé').slice(0, 10000),
          resolution: importedResolution(x),
          sourceList: x.sourceList,
          sourceData: x.sourceData,
          sourceId: x.externalId,
          comments: x.historicalNotes
            ? [
                {
                  id: crypto.randomUUID(),
                  author: 'Historique importé',
                  text: String(x.historicalNotes).slice(0, 20000),
                  date: x.created,
                  mentions: [],
                },
              ]
            : [],
          history,
        };
        statements.push(
          db
            .prepare(
              'INSERT INTO records(id,payload,version) VALUES (?,?,1) ON CONFLICT (id) DO NOTHING',
            )
            .bind(id, JSON.stringify(r)),
        );
      }
      // Tout le lot déjà présent : rien à écrire (un lot vide est refusé par D1)
      if (!statements.length) return out({ imported: 0, skipped: b.records.length });
      const results = await db.batch(statements);
      const imported = results.reduce((n: number, x) => n + (x.meta.changes || 0), 0);
      return out({ imported, skipped: b.records.length - imported });
    }
    // Espace Contentieux (responsables) : un contentieux par ligne de settings, « contentieux:<id> »
    if (String(b.action).startsWith('contentieux-')) {
      if (!admin) return out({ error: 'Espace réservé aux admins.' }, 403);
      // Listes réglables (Paramètres → Contentieux) : types, sujets et sous-sujets, décisions
      const cfgRow = await db
        .prepare('SELECT payload FROM settings WHERE id=?')
        .bind(CONTENTIEUX_SETTINGS_KEY)
        .first<SettingRow>();
      const cfg = cfgRow ? JSON.parse(cfgRow.payload) : DEFAULT_CONTENTIEUX_SETTINGS;
      if (b.action === 'contentieux-settings') {
        const { error, settings } = normalizeContentieuxSettings(b.settings);
        if (error) return out({ error }, 400);
        const statements = [
          db
            .prepare(
              'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
            )
            .bind(CONTENTIEUX_SETTINGS_KEY, JSON.stringify(settings)),
        ];
        // Renommages appliqués aussi aux contentieux déjà saisis, si demandé
        if (b.applyToRecords && Array.isArray(b.renames) && b.renames.length) {
          const all = await settingsByPrefix(db, CONTENTIEUX_PREFIX);
          for (const c of applyContentieuxRenames(
            all.results.map((r) => JSON.parse(r.payload)),
            b.renames,
            { now, author: member.name },
          ))
            statements.push(
              db
                .prepare('UPDATE settings SET payload=? WHERE id=?')
                .bind(JSON.stringify(c), CONTENTIEUX_PREFIX + c.id),
            );
        }
        await db.batch(statements);
        return out({ ok: true });
      }
      const id = String(b.id || '');
      const row = id
        ? await db
            .prepare('SELECT payload FROM settings WHERE id=?')
            .bind(CONTENTIEUX_PREFIX + id)
            .first<SettingRow>()
        : null;
      if (id && !row) return out({ error: 'Contentieux introuvable.' }, 404);
      const current = row ? JSON.parse(row.payload) : null;
      if (b.action === 'contentieux-delete') {
        if (!current) return out({ error: 'Contentieux introuvable.' }, 404);
        await db
          .prepare('DELETE FROM settings WHERE id=?')
          .bind(CONTENTIEUX_PREFIX + id)
          .run();
        // Ses pièces jointes : rangées dans la corbeille du stockage (effacées seulement si un admin active le vidage automatique)
        if (env.BUCKET)
          for (const a of current.attachments || [])
            await moveToTrash(env.BUCKET, 'contentieux/' + id + '/' + a.id, member.email, now);
        return out({ ok: true });
      }
      let dossier: { id: string; ref: string } | null = null;
      if (b.dossierId) {
        const d = await db
          .prepare("SELECT payload::jsonb->>'ref' AS ref FROM records WHERE id=?")
          .bind(String(b.dossierId))
          .first<{ ref: string }>();
        if (d) dossier = { id: String(b.dossierId), ref: d.ref };
      }
      const result = applyContentieuxAction(current, b, {
        now,
        today: creditToday(new Date(now)),
        author: member.name,
        newId: crypto.randomUUID(),
        dossier,
        settings: cfg,
      });
      if (result.error) return out({ error: result.error }, result.status || 400);
      if (result.unchanged) return out({ ok: true, unchanged: true });
      const item = result.item;
      if (current) {
        // Enregistré seulement si personne ne l'a modifié entre-temps
        const saved = await db
          .prepare(
            "UPDATE settings SET payload=jsonb_set(?::jsonb, '{attachments}', COALESCE(payload::jsonb->'attachments', '[]'::jsonb))::text WHERE id=? AND payload::jsonb->>'version' = ?::text",
          )
          .bind(JSON.stringify(item), CONTENTIEUX_PREFIX + item.id, current.version)
          .run();
        if (!saved.meta.changes)
          return out(
            {
              error: 'Un autre admin a modifié ce contentieux. Actualisez avant de réessayer.',
            },
            409,
          );
      } else
        await db
          .prepare('INSERT INTO settings(id,payload) VALUES (?,?)')
          .bind(CONTENTIEUX_PREFIX + item.id, JSON.stringify(item))
          .run();
      return out({ ok: true, id: item.id });
    }
    if (b.action === 'create') {
      if (member.role === 'Service Litige' || member.role === 'Responsable')
        return out({ error: 'Création réservée à la RC, au SAV et aux admins.' }, 403);
      const x = b.record;
      if (
        !x ||
        !String(x.title || '').trim() ||
        !String(x.order || '').trim() ||
        !String(x.customerAccount || '').trim() ||
        !String(x.description || '').trim() ||
        !x.type ||
        !String(x.brand || '').trim() ||
        !String(x.productType || '').trim() ||
        !['Transport', 'Interne'].includes(x.origin) ||
        !Number.isFinite(Number(x.disputeValue ?? x.amount)) ||
        Number(x.disputeValue ?? x.amount) < 0
      )
        return out({ error: 'Complétez les champs obligatoires et un montant positif.' }, 400);
      // Demandeur obligatoire : un compte actif de l'équipe (l'agent connecté par défaut)
      const requesterEmail = String(x.requesterEmail || member.email).toLowerCase();
      const requester =
        requesterEmail === String(member.email).toLowerCase()
          ? member
          : await resolveMember(db, requesterEmail);
      if (!requester) return out({ error: 'Choisissez un demandeur dans l’équipe.' }, 400);
      // Enseigne « MAGASIN » : le magasin est obligatoire
      const store = x.brand === STORE_BRAND ? String(x.store || '').trim() : '';
      if (x.brand === STORE_BRAND && !store)
        return out({ error: 'Choisissez le magasin concerné.' }, 400);
      const id = crypto.randomUUID();
      const r = {
        id,
        ref: 'LIT-' + now.slice(0, 4) + '-' + id.slice(0, 6).toUpperCase(),
        title: String(x.title).slice(0, 200),
        order: String(x.order).slice(0, 100),
        // Nom du client facultatif ; numéro de compte client obligatoire
        customer:
          String(x.customer || '')
            .trim()
            .slice(0, 150) || 'Non renseigné',
        customerAccount: String(x.customerAccount).trim().slice(0, 60),
        description: String(x.description).slice(0, 10000),
        // Montant de commande : plus demandé à la création (repris des anciens dossiers seulement)
        amount: Number(x.amount) || 0,
        type: String(x.type).slice(0, 100),
        origin: x.origin,
        // Transporteur seulement pour un litige d'origine Transport
        carrier: x.origin === 'Transport' ? String(x.carrier || '').slice(0, 100) : '',
        brand: String(x.brand || '').slice(0, 120),
        store: store.slice(0, 120),
        productType: String(x.productType || '').slice(0, 120),
        productRef: String(x.productRef || '').slice(0, 200),
        requester: String(requester.name).slice(0, 200),
        requesterEmail: String(requester.email).toLowerCase(),
        ticket: String(x.ticket || '').slice(0, 200),
        bt: String(x.bt || '').slice(0, 200),
        outcome: '',
        creditNumber: '',
        invoice: '',
        creditCreated: null,
        // Montant concerné par le litige, saisi à la création
        // (ancien format : le montant de commande, s'il est seul fourni)
        disputeValue: Math.round(Number(x.disputeValue ?? x.amount) * 100) / 100,
        takenAt: null,
        carrierStatus: 'À transmettre',
        clientStage: 'En attente réponse transporteur',
        carrierCaseRef: '',
        carrierSentAt: null,
        carrierResponseDue: null,
        carrierFollowupAt: null,
        carrierReplyAt: null,
        rcCheck: '',
        rcManager: '',
        followUp: '',
        solution: '',
        solco: '',
        compensationState: '',
        indemTps: 0,
        transportMessages: [],
        priority: x.priority === 'Haute' ? 'Haute' : 'Normale',
        status: 'Nouveau',
        statusSince: now,
        created: now,
        creator: member.email,
        assignee: '',
        creditIssued: false,
        credit: 0,
        compensation: 0,
        closed: null,
        reopened: [],
        resolution: null,
        comments: [],
        history: [
          { date: now, text: 'Dossier créé et transmis au service litige', author: member.name },
        ],
      };
      await db
        .prepare('INSERT INTO records(id,payload,version) VALUES (?,?,1)')
        .bind(id, JSON.stringify(r))
        .run();
      // Litige ouvert en « Inversion » : e-mail à toute l'équipe (Service Litige, responsables,
      // agents). Préparé dans la file d'envoi ; parti dès que l'envoi d'e-mails (Microsoft 365)
      // est branché. La notification « Prioritaires » de la cloche est calculée (app/alerts.mjs).
      if (isPriorityType(r.type)) {
        const team = await db
          .prepare("SELECT email FROM members WHERE role <> 'Désactivé'")
          .all<{ email: string }>();
        await queueMail(db, {
          to: team.results.map((m) => m.email),
          subject: 'Litige prioritaire (' + r.type + ') : ' + r.ref + ' · commande ' + r.order,
          text:
            r.title +
            '\nOuvert par ' +
            member.name +
            ' le ' +
            now.slice(0, 10).split('-').reverse().join('/') +
            '\nCompte client : ' +
            r.customerAccount,
          record: r.id,
          at: now,
        });
      }
      return out({ ok: true, id });
    }
    // Notifications par catégorie (app/alerts.mjs) marquées comme lues par l'agent
    // Actions groupées de la liste : attribution, statut (service litige et responsables)
    if (b.action === 'bulk') {
      const req = normalizeBulk(b);
      if (req.error) return out({ error: req.error }, 400);
      if (!litige)
        return out({ error: 'Réservé au Service Litige, aux Responsables et aux Admins.' }, 403);
      let assigneeName = '';
      if (req.op === 'assign' && req.value) {
        const agent = await resolveMember(db, req.value);
        if (!agent) return out({ error: 'Agent introuvable ou désactivé.' }, 400);
        assigneeName = agent.name;
      }
      let done = 0;
      const skipped: { id: string; reason: string }[] = [];
      for (const id of req.ids!) {
        let reason: string | null = null;
        const refused = await updateRecord(db, id, (r) => {
          reason = applyBulk(
            r,
            { op: req.op!, value: req.value! },
            {
              now,
              author: member.name,
              assigneeName,
            },
          );
          if (reason) return out({ skipped: reason });
          r.rev = (r.rev || 0) + 1;
        });
        if (reason) skipped.push({ id, reason });
        else if (refused) skipped.push({ id, reason: 'introuvable ou modifié en même temps' });
        else done++;
      }
      return out({ ok: true, done, skipped });
    }
    // « Relance faite » : relance notée dans l'historique, prochaine relance repoussée
    if (b.action === 'carrier-followup-done') {
      if (!litige) return out({ error: 'Réservé au service litige.' }, 403);
      const stored = await db
        .prepare('SELECT payload FROM settings WHERE id=?')
        .bind('carrier-delays')
        .first<SettingRow>();
      const delays = stored ? JSON.parse(stored.payload) : DEFAULT_CARRIER_DELAYS;
      const next = nextFollowup(parisToday(), delays);
      const refused = await updateRecord(db, String(b.id || ''), (r) => {
        if (!r.carrierSentAt)
          return out({ error: 'Indiquez d’abord la date de transmission au transporteur.' }, 400);
        r.carrierFollowupAt = next;
        r.history = [
          ...(r.history || []),
          {
            date: now,
            text:
              'Relance transporteur faite · prochaine relance le ' +
              next.split('-').reverse().join('/'),
            author: member.name,
          },
        ];
        r.rev = (r.rev || 0) + 1;
      });
      if (refused) return refused;
      return out({ ok: true, next });
    }
    // Pré-remplissage d'après les échanges (responsables) : champs vides seulement, marqués
    // « à vérifier » (app/prefill.mjs)
    if (b.action === 'prefill') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const catalogRow = await db
        .prepare('SELECT payload FROM settings WHERE id=?')
        .bind('catalogs')
        .first<SettingRow>();
      const stored = catalogRow ? JSON.parse(catalogRow.payload) : {};
      const ctx = {
        now,
        author: member.name,
        carrierStages: stored.carrierStages || DEFAULT_STAGES.carrierStages,
        clientStages: stored.clientStages || DEFAULT_STAGES.clientStages,
        outcomes: stored.outcomes || outcomes,
      };
      let result = { applied: [] as string[], skipped: [] as { field: string; reason: string }[] };
      const refused = await updateRecord(db, String(b.id || ''), (r) => {
        result = applyPrefill(r, b.fields || {}, b.sources || {}, ctx);
        if (!result.applied.length) return out({ ok: true, ...result });
      });
      if (refused && !result.applied.length && refused.status !== 200) return refused;
      return out({ ok: true, ...result });
    }
    // Pré-remplissage vérifié par le Service Litige : le repère « à vérifier » disparaît
    if (b.action === 'prefill-ok') {
      if (!litige) return out({ error: 'Réservé au service litige.' }, 403);
      const refused = await updateRecord(db, String(b.id || ''), (r) => {
        if (!r.prefilled) return out({ ok: true });
        r.history = [
          ...(r.history || []),
          { date: now, text: 'Pré-remplissage vérifié', author: member.name },
        ];
        delete r.prefilled;
      });
      if (refused && refused.status !== 200) return refused;
      return out({ ok: true });
    }
    // « Client qui s'impatiente » : repère posé ou retiré par la RC ou le SAV (app/impatience.mjs).
    // Sans révision (rev) : un traitement ouvert par le Service Litige n'est pas refusé pour ça.
    if (b.action === 'client-impatient') {
      if (!canFlagImpatience(member.role))
        return out({ error: 'Réservé à la Relation client et au SAV.' }, 403);
      const refused = await updateRecord(db, String(b.id || ''), (r) => {
        const error = setImpatience(r, !!b.on, member, now);
        if (error) return out({ error }, 400);
      });
      if (refused) return refused;
      return out({ ok: true });
    }
    if (b.action === 'watch-many') {
      const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 500) : [];
      const saved = await updateUserList(db, watchKey(member.email), (list) => {
        for (const id of ids) {
          const res = toggleWatch(list, id, !!b.on);
          if (res.error) return res;
          list = res.list!;
        }
        return { list };
      });
      if (saved.error) return out({ error: saved.error }, saved.status || 400);
      return out({ ok: true });
    }
    if (b.action === 'reminder-add' || b.action === 'reminder-delete') {
      if (b.action === 'reminder-add') {
        const exists = await db
          .prepare('SELECT 1 AS ok FROM records WHERE id=?')
          .bind(String(b.id || ''))
          .first();
        if (!exists) return out({ error: 'Dossier introuvable' }, 404);
      }
      const reminderId = crypto.randomUUID();
      const saved = await updateUserList(db, remindersKey(member.email), (list) =>
        b.action === 'reminder-add'
          ? addReminder(
              list,
              { recordId: b.id, date: b.date, note: b.note },
              { id: reminderId, now },
            )
          : removeReminder(list, String(b.reminderId || '')),
      );
      if (saved.error) return out({ error: saved.error }, saved.status || 400);
      return out({ ok: true });
    }
    if (b.action === 'watch') {
      const id = String(b.id || '');
      const exists = await db.prepare('SELECT 1 AS ok FROM records WHERE id=?').bind(id).first();
      if (!exists) return out({ error: 'Dossier introuvable' }, 404);
      const saved = await updateUserList(db, watchKey(member.email), (list) =>
        toggleWatch(list, id, !!b.on),
      );
      if (saved.error) return out({ error: saved.error }, saved.status || 400);
      return out({ ok: true, watching: saved.list });
    }
    if (b.action === 'read-alert') {
      const keys = b.keys;
      if (
        !Array.isArray(keys) ||
        !keys.length ||
        keys.length > 500 ||
        keys.some((k) => typeof k !== 'string' || !ALERT_KEY_PATTERN.test(k))
      )
        return out({ error: 'Notification invalide.' }, 400);
      await db
        .prepare(
          "INSERT INTO settings(id,payload) SELECT ?::text || v, jsonb_build_object('key', v, 'readAt', ?::text)::text FROM jsonb_array_elements_text(?::jsonb) v ON CONFLICT (id) DO NOTHING",
        )
        .bind('alert-read:' + reader + ':', now, JSON.stringify([...new Set(keys)]))
        .run();
      return out({ ok: true });
    }
    if (b.action === 'read-notification') {
      const supplied = b.commentIds ?? (b.commentId ? [b.commentId] : null);
      if (
        typeof b.id !== 'string' ||
        b.id.length > 200 ||
        !Array.isArray(supplied) ||
        !supplied.length ||
        supplied.length > 5000 ||
        supplied.some((id) => typeof id !== 'string' || !id || id.length > 200)
      )
        return out({ error: 'Notification invalide.' }, 400);
      const ids = [...new Set(supplied)] as string[];
      const row = await db
        .prepare('SELECT payload FROM records WHERE id=?')
        .bind(b.id)
        .first<Pick<RecordRow, 'payload'>>();
      if (!row) return out({ error: 'Dossier introuvable' }, 404);
      const record: Dossier = JSON.parse(row.payload);
      const allowed = new Set(
        (record.comments || []).filter((c) => c.mentions?.includes(member.email)).map((c) => c.id),
      );
      if (ids.some((id) => !allowed.has(id)))
        return out({ error: 'Cette notification ne vous est pas destinée.' }, 403);
      await db
        .prepare(
          "INSERT INTO settings(id,payload) SELECT ?::text || v, jsonb_build_object('key', ?::text || v, 'readAt', ?::text)::text FROM jsonb_array_elements_text(?::jsonb) v ON CONFLICT (id) DO NOTHING",
        )
        .bind(
          'notification-read:' + reader + ':' + b.id + ':',
          b.id + ':',
          now,
          JSON.stringify(ids),
        )
        .run();
      return out({ ok: true });
    }

    // Suppression d'un dossier (admins seulement). Une copie est gardée dans les réglages
    // (« dossier-supprime:<id> ») et ses pièces jointes vont dans la corbeille du stockage :
    // un dossier supprimé par erreur reste récupérable.
    if (b.action === 'record-delete') {
      if (!admin) return out({ error: 'Accès admin requis' }, 403);
      const id = String(b.id || '');
      const row = id
        ? await db.prepare('SELECT payload FROM records WHERE id=?').bind(id).first<SettingRow>()
        : null;
      if (!row) return out({ error: 'Dossier introuvable' }, 404);
      const record: Dossier = JSON.parse(row.payload);
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind(
          'dossier-supprime:' + id,
          JSON.stringify({ record, deletedBy: member.email, deletedAt: now }),
        )
        .run();
      await db.prepare('DELETE FROM records WHERE id=?').bind(id).run();
      if (env.BUCKET)
        for (const a of record.attachments || [])
          await moveToTrash(env.BUCKET, 'attachments/' + id + '/' + a.id, member.email, now);
      return out({ ok: true });
    }

    // Demandes d'avoir (app/credit-requests.mjs). Le dossier est relu à sa dernière version :
    // faire avancer un avoir n'échoue pas si un collègue a modifié un autre champ.
    if (String(b.action || '').startsWith('credit-')) {
      const stored = await db
        .prepare('SELECT payload FROM settings WHERE id=?')
        .bind('credit-settings')
        .first<SettingRow>();
      const settings = stored ? JSON.parse(stored.payload) : DEFAULT_CREDIT_SETTINGS;
      const id = String(b.id || '');
      if (!id || id.length > 200) return out({ error: 'Dossier invalide.' }, 400);
      const newId = crypto.randomUUID(),
        today = creditToday(new Date(now));
      let message: string | undefined = '';
      const refused = await updateRecord(db, id, (r) => {
        const result: CreditActionResult = applyCreditAction(
          r,
          { ...b, newId },
          member,
          settings,
          now,
          today,
        );
        if (result.error) return out({ error: result.error }, result.status);
        r.rev = (r.rev || 0) + 1;
        message = result.message;
      });
      if (refused) return refused;
      return out({ ok: true, message });
    }

    const row = await db
      .prepare('SELECT * FROM records WHERE id=?')
      .bind(String(b.id || ''))
      .first<RecordRow>();
    if (!row) return out({ error: 'Dossier introuvable' }, 404);
    // Un commentaire, un message transporteur ou le suivi client s'ajoutent sans écraser le reste :
    // ils ne sont pas refusés parce qu'un collègue a modifié le dossier entre-temps.
    const appendOnly = ['comment', 'transport', 'client-followup'].includes(b.action);
    const r: Dossier = JSON.parse(row.payload);
    // Modification du traitement ou des informations : refusée seulement si le CONTENU a changé
    // depuis l'ouverture (révision « rev »). Un commentaire d'un collègue ne la bloque pas.
    const stale =
      b.rev !== undefined && b.rev !== null
        ? Number(r.rev || 0) !== Number(b.rev)
        : row.version !== b.version;
    if (!appendOnly && stale)
      return out(
        { error: 'Un autre agent a modifié ce dossier. Actualisez avant de réessayer.' },
        409,
      );
    // Le suivi client (RC, SAV) compte aussi comme une modification : un traitement ouvert avant
    // ne doit pas l'écraser sans prévenir
    if (!appendOnly || b.action === 'client-followup') r.rev = (r.rev || 0) + 1;
    // Anciens dossiers repris sans historique : on en crée un vide plutôt que d'échouer
    r.history = r.history || [];
    if (b.action === 'edit-info') {
      // Correction des informations du dossier (montant, n° de commande…) : responsables
      if (!admin) return out({ error: 'Modification réservée aux admins.' }, 403);
      const { values, changes, error } = applyInfoEdit(r, b.info || {});
      if (error) return out({ error }, 400);
      if (!changes!.length) return out({ ok: true, unchanged: true });
      Object.assign(r, values);
      r.history!.push({ date: now, text: changesText(changes!), author: member.name });
    } else if (b.action === 'client-followup') {
      const catalogRow = await db
        .prepare('SELECT payload FROM settings WHERE id=?')
        .bind('catalogs')
        .first<SettingRow>();
      const stages: string[] =
        (catalogRow && JSON.parse(catalogRow.payload).clientStages) || clientStages;
      // Étape de la liste, ou ancienne étape inchangée (reprise de SharePoint, hors liste)
      if (!stages.includes(b.clientStage) && b.clientStage !== r.clientStage)
        return out({ error: 'Étape client invalide.' }, 400);
      r.clientStage = b.clientStage;
      r.rcCheck = String(b.rcCheck || '').slice(0, 500);
      r.followUp = String(b.followUp || '').slice(0, 500);
      r.history!.push({ date: now, text: 'Suivi client : ' + r.clientStage, author: member.name });
      stampMilestones(r, now);
    } else if (b.action === 'transport') {
      if (!litige) return out({ error: 'Réservé au service litige.' }, 403);
      const m = b.message;
      if (
        !m ||
        ![
          'Brouillon',
          'E-mail envoyé (saisi manuellement)',
          'E-mail reçu (saisi manuellement)',
        ].includes(m.kind) ||
        !String(m.body || '').trim() ||
        String(m.body).length > 15000 ||
        !String(m.subject || '').trim() ||
        String(m.subject).length > 300 ||
        !/^\S+@\S+\.\S+$/.test(String(m.contact || '')) ||
        !Number.isFinite(Date.parse(m.date))
      )
        return out({ error: 'Vérifiez le message, le contact et la date.' }, 400);
      r.transportMessages = [
        ...(r.transportMessages || []),
        {
          id: crypto.randomUUID(),
          kind: m.kind,
          contact: m.contact,
          subject: m.subject,
          body: m.body,
          date: m.date,
          author: member.name,
          recorded: now,
        },
      ];
    } else if (b.action === 'comment') {
      if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > 5000)
        return out({ error: 'Commentaire requis (5 000 caractères maximum).' }, 400);
      if (
        b.mentions != null &&
        (!Array.isArray(b.mentions) ||
          b.mentions.length > 20 ||
          b.mentions.some((x: Untrusted) => typeof x !== 'string'))
      )
        return out({ error: 'Liste des agents mentionnés invalide.' }, 400);
      const mentions = [
        ...new Set((b.mentions || []).map((email: string) => email.toLowerCase())),
      ] as string[];
      if (mentions.length) {
        // Agents mentionnables : adresses actives, ou chacun de leurs profils (adresse partagée)
        const agents = await db
          .prepare("SELECT email, name, role FROM members WHERE role <> 'Désactivé'")
          .all<Member>();
        const active = new Set(
          expandMembers(agents.results, await loadProfiles(db)).map((a) => a.email.toLowerCase()),
        );
        if (mentions.some((email) => !active.has(email)))
          return out(
            {
              error:
                'Un agent mentionné n’est plus disponible. Actualisez puis sélectionnez à nouveau la personne.',
            },
            400,
          );
      }
      r.comments.push({
        id: crypto.randomUUID(),
        text: b.text.trim(),
        author: member.name,
        email: member.email,
        date: now,
        mentions,
      });
    } else if (b.action === 'update') {
      if (!STATUSES.includes(b.status)) return out({ error: 'Statut invalide' }, 400);
      if (
        !litige &&
        !(r.status === 'Résolu' && b.status === 'Réouvert') &&
        !(r.status === 'En attente RC' && b.status === 'Pris en charge')
      )
        return out({ error: 'Action réservée au service litige.' }, 403);
      const transitions: Record<string, string[]> = {
        Nouveau: ['Pris en charge'],
        'Pris en charge': ['En attente RC', 'Résolu'],
        'En attente RC': ['Pris en charge', 'Résolu'],
        Résolu: ['Réouvert'],
        Réouvert: ['Pris en charge', 'En attente RC', 'Résolu'],
      };
      if (b.status !== r.status && !transitions[r.status].includes(b.status))
        return out({ error: 'Transition non autorisée.' }, 400);
      if (litige) {
        if (!Number.isFinite(Number(b.compensation)) || Number(b.compensation) < 0)
          return out({ error: 'Indemnisation invalide' }, 400);
        try {
          const before = {
            creditNumber: r.creditNumber,
            credit: r.credit,
            creditIssuedAt: r.creditIssuedAt,
          };
          Object.assign(r, resolveCredit(r, b, new Date(now)));
          r.creditIssuedAt = creditIssuedStamp(before, r, now);
        } catch (e) {
          return out({ error: e instanceof Error ? e.message : String(e) }, 400);
        }
        r.compensation = Number(b.compensation);
        // Date d'attribution : déclenche la notification « Dossier attribué »
        if (String(b.assignee || '') !== String(r.assignee || '')) r.assignedAt = now;
        r.assignee = String(b.assignee || '');
        for (const k of [
          'outcome',
          'invoice',
          'carrierStatus',
          'rcCheck',
          'rcManager',
          'followUp',
          'solution',
          'solco',
          'compensationState',
          'carrierCaseRef',
          'clientStage',
        ] as const)
          r[k] = String(b[k] || '').slice(0, 1000);
        // Décision du transporteur (vide tant qu'elle n'est pas connue)
        if (b.carrierDecision && !CARRIER_DECISIONS.includes(b.carrierDecision))
          return out({ error: 'Décision du transporteur invalide.' }, 400);
        r.carrierDecision = String(b.carrierDecision || '');
        // Imputation (Interne / Transporteur / Autre), vide tant que non précisée
        if (b.imputation && !IMPUTATIONS.includes(b.imputation))
          return out({ error: 'Imputation invalide.' }, 400);
        r.imputation = String(b.imputation || '');
        for (const k of ['disputeValue', 'indemTps'] as const) {
          if (!Number.isFinite(Number(b[k] || 0)) || Number(b[k] || 0) < 0)
            return out({ error: 'Montant invalide' }, 400);
          r[k] = Number(b[k] || 0);
        }
        for (const k of [
          'carrierSentAt',
          'carrierResponseDue',
          'carrierFollowupAt',
          'carrierReplyAt',
        ] as const) {
          if (b[k] && !Number.isFinite(Date.parse(b[k])))
            return out({ error: 'Date de suivi transporteur invalide.' }, 400);
          r[k] = b[k] || null;
        }
        if (r.carrierReplyAt && r.carrierSentAt && r.carrierReplyAt < r.carrierSentAt)
          return out({ error: 'La réponse ne peut pas précéder la transmission.' }, 400);
        if (r.status === 'Nouveau' && b.status === 'Pris en charge') r.takenAt = now;
        // Fin du dossier transporteur et solution client définitive : délais (app/delays.mjs)
        stampMilestones(r, now);
      }
      if (b.status === 'Résolu' && r.status !== 'Résolu') {
        if (!String(b.outcome || '').trim())
          return out({ error: 'Précisez le résultat du litige.' }, 400);
        if (!IMPUTATIONS.includes(b.imputation))
          return out({ error: 'Précisez l’imputation : Interne, Transporteur ou Autre.' }, 400);
        // Conclusion toujours déduite du résultat (avéré / non avéré), motif = le résultat
        const outcome = String(b.outcome).trim().slice(0, 1000);
        r.resolution = { verdict: verdictOf(outcome), reason: outcome };
        r.closed = now;
      } else if (
        b.status === 'Résolu' &&
        r.status === 'Résolu' &&
        litige &&
        String(r.outcome || '').trim() &&
        r.resolution?.reason !== r.outcome
      ) {
        // Dossier déjà résolu dont le résultat est complété ou corrigé : la conclusion suit
        r.resolution = { verdict: verdictOf(String(r.outcome)), reason: String(r.outcome) };
      }
      // Date de clôture choisie (ancien dossier sans date, ou clôture saisie après coup) :
      // Service Litige, Responsables, admins (app/closing-date.mjs)
      if (
        b.status === 'Résolu' &&
        litige &&
        typeof b.closedDate === 'string' &&
        b.closedDate &&
        b.closedDate !== closedDay(r)
      ) {
        const error = closedDayError(b.closedDate, r.created, now);
        if (error) return out({ error }, 400);
        r.closed = closedFromDay(b.closedDate);
        r.history!.push({
          date: now,
          text: 'Date de clôture : ' + b.closedDate.split('-').reverse().join('/'),
          author: member.name,
        });
      }
      if (b.status === 'Réouvert' && r.status === 'Résolu') {
        if (!String(b.reopenReason || '').trim())
          return out({ error: 'Indiquez le motif de réouverture.' }, 400);
        r.reopened.push(now);
        r.history!.push({
          date: now,
          text: 'Réouverture : ' + String(b.reopenReason).slice(0, 1000),
          author: member.name,
        });
        r.closed = null;
      }
      r.history!.push({
        date: now,
        text: r.status === b.status ? 'Informations mises à jour' : r.status + ' → ' + b.status,
        author: member.name,
      });
      // Début du compte des délais « temps passé dans un statut » (app/sla.mjs)
      if (r.status !== b.status) r.statusSince = now;
      r.status = b.status;
    } else return out({ error: 'Action inconnue' }, 400);
    const result = await db
      .prepare('UPDATE records SET payload=?,version=version+1 WHERE id=? AND version=?')
      .bind(JSON.stringify(r), r.id, row.version)
      .run();
    if (!result.meta.changes)
      return out({ error: 'Le dossier vient d’être modifié par un collègue. Réessayez.' }, 409);
    return out({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
