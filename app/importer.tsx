'use client';
import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Upload, Check, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { fields, guess, statusGuess, transform } from './import-logic.mjs';
import { dateTime } from './datetime.mjs';
import type { ImportItem } from './types';

// Partie de la bibliothèque SheetJS utilisée ici (chargée à la demande, /xlsx.full.min.js)
interface Workbook {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}
interface XlsxLib {
  read(data: ArrayBuffer, options: { type: 'array'; cellDates: boolean }): Workbook;
  utils: { sheet_to_json(sheet: unknown, options: { defval: string; raw: boolean }): unknown[] };
}
// Classeur ouvert et fonctions de lecture associées
interface LoadedBook {
  book: Workbook;
  utils: XlsxLib['utils'];
}
// Ligne d'une feuille : nom de colonne → valeur de la cellule
type SheetRow = Record<string, unknown>;
// Ligne analysée : dossier obtenu, erreurs bloquantes et avertissements
interface ImportPreview {
  line: number;
  errors: string[];
  warnings: string[];
  record: ImportItem;
}

interface ImporterProps {
  onImport: (
    items: ImportItem[],
    fileName: string,
  ) => Promise<{ imported: number; skipped: number }>;
  busy: boolean;
}
async function loadExcel(): Promise<XlsxLib> {
  const w = window as Window & { XLSX?: XlsxLib };
  if (w.XLSX) return w.XLSX;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/xlsx.full.min.js?v=0.20.3';
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('Impossible de charger le lecteur Excel. Réessayez.'));
    };
    document.head.appendChild(script);
  });
  // Relu après le chargement du script, qui vient de définir window.XLSX
  return (w as { XLSX?: XlsxLib }).XLSX as XlsxLib;
}
export default function Importer({ onImport, busy }: ImporterProps) {
  const [book, setBook] = useState<LoadedBook | null>(null),
    [sheet, setSheet] = useState(''),
    [rows, setRows] = useState<SheetRow[]>([]),
    [map, setMap] = useState<Record<string, string>>({}),
    [statusMap, setStatusMap] = useState<Record<string, string>>({}),
    [step, setStep] = useState(1),
    [fileName, setFileName] = useState(''),
    [error, setError] = useState(''),
    [done, setDone] = useState<{ imported: number; skipped: number; at: string } | null>(null),
    [accepted, setAccepted] = useState(false),
    [defaults, setDefaults] = useState({
      status: '',
      origin: 'Transport',
      type: 'Non classé (import)',
      sourceList: 'Dépot Litiges VPC',
      dateFormat: 'fr',
    });
  const headers = rows.length ? Object.keys(rows[0]) : [],
    rawStatuses = Array.from(new Set(rows.map((r) => String(r[map.status] ?? '').trim()))),
    preview = useMemo<ImportPreview[]>(
      () => transform(rows, map, statusMap, defaults),
      [rows, map, statusMap, defaults],
    ),
    errors = preview.filter((p) => p.errors.length),
    warnings = preview.filter((p) => p.warnings.length);
  function setSheetRows(w: LoadedBook, name: string) {
    const rs = w.utils.sheet_to_json(w.book.Sheets[name], { defval: '', raw: true }) as SheetRow[];
    if (rs.length > 5000)
      throw new Error('Limite de 5 000 lignes par fichier. Fractionnez votre export.');
    if (!rs.length) throw new Error('La feuille ne contient aucune ligne de données.');
    setRows(rs);
    const m = guess(Object.keys(rs[0]));
    setMap(m);
    setStatusMap(
      Object.fromEntries(
        Array.from(new Set(rs.map((r) => String(r[m.status] ?? '').trim()))).map((s) => [
          s,
          statusGuess(s),
        ]),
      ),
    );
    setAccepted(false);
    setSheet(name);
  }
  async function readFile(file: File) {
    setError('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Limite de 10 Mo par fichier.');
      if (!/\.(xlsx|xls|csv)$/i.test(file.name))
        throw new Error(
          'Utilisez un fichier .xlsx, .xls ou .csv. Les fichiers .iqy doivent être ouverts dans Excel puis enregistrés en .xlsx.',
        );
      const x = await loadExcel(),
        b = x.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const w = { book: b, utils: x.utils };
      setBook(w);
      setFileName(file.name);
      setSheetRows(w, b.SheetNames[0]);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function confirm() {
    setError('');
    if (errors.length) return;
    try {
      const result = await onImport(
        preview.map((p) => p.record),
        fileName,
      );
      setDone({ ...result, at: new Date().toISOString() });
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <>
      <span className="eyebrow">REPRISE DE VOTRE HISTORIQUE</span>
      <h2>Importer depuis Microsoft Lists</h2>
      <p>Conservez vos dossiers en cours et déjà traités, sans ressaisie.</p>
      <div className="progress-steps">
        {['Fichier', 'Correspondance', 'Vérification', 'Résultat'].map((s, i) => (
          <span key={s} className={step === i + 1 ? 'active' : ''}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      {step === 1 && (
        <>
          <div className="import-zone">
            <FileSpreadsheet size={40} />
            <h3>Votre export Excel, votre point de départ.</h3>
            <p>Formats .xlsx, .xls et .csv · 10 Mo · 5 000 lignes maximum</p>
            <input
              aria-label="Sélectionner un export Excel"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files?.[0]) readFile(e.target.files[0]);
              }}
            />
          </div>
          <div className="import-message">
            Exportez votre liste dans Excel, puis enregistrez le classeur au format .xlsx. Si
            Microsoft Lists fournit un fichier .iqy, ouvrez-le dans Excel et enregistrez ensuite le
            résultat en .xlsx.
            <br />
            Les données ne sont pas enregistrées avant votre confirmation finale.
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <div className="import-message">
            <b>{fileName}</b> · {rows.length} lignes détectées. Les colonnes sont proposées
            automatiquement ; vérifiez chaque correspondance.
          </div>
          <label>
            Feuille du classeur
            <select
              value={sheet}
              onChange={(e) => {
                try {
                  setSheetRows(book!, e.target.value);
                } catch (x) {
                  setError(x instanceof Error ? x.message : String(x));
                }
              }}
            >
              {book!.book.SheetNames.map((s: string) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Format des dates texte
            <select
              value={defaults.dateFormat}
              onChange={(e) => setDefaults({ ...defaults, dateFormat: e.target.value })}
            >
              <option value="fr">Jour / mois / année (ex. 21/08/2025)</option>
              <option value="us">Mois / jour / année (ex. 8/21/2025)</option>
            </select>
          </label>
          <label>
            Nom unique de la liste source
            <input
              required
              value={defaults.sourceList}
              onChange={(e) => setDefaults({ ...defaults, sourceList: e.target.value })}
            />
          </label>
          <small className="muted">
            Gardez ce nom pour les imports suivants : l’identifiant source sert à éviter les
            doublons.
          </small>
          <div className="import-grid">
            {fields.map(([k, label]) => (
              <div className="mapping-row" key={k}>
                <span>
                  {label}
                  {['created'].includes(k) ? ' *' : ''}
                </span>
                <select
                  aria-label={'Colonne : ' + label}
                  value={map[k] || ''}
                  onChange={(e) => {
                    const m = { ...map, [k]: e.target.value };
                    setMap(m);
                    if (k === 'status')
                      setStatusMap(
                        Object.fromEntries(
                          Array.from(
                            new Set(rows.map((r) => String(r[e.target.value] ?? '').trim())),
                          ).map((s) => [s, statusGuess(s)]),
                        ),
                      );
                  }}
                >
                  <option value="">Non renseigné dans l’export</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <h3 style={{ margin: '20px 0 10px' }}>Correspondance des statuts</h3>
          {map.status ? (
            rawStatuses.map((s) => (
              <div key={s} className="mapping-row">
                <span>{s || '(vide)'}</span>
                <select
                  aria-label={'Statut source : ' + (s || 'vide')}
                  value={statusMap[s] || ''}
                  onChange={(e) => setStatusMap({ ...statusMap, [s]: e.target.value })}
                >
                  <option value="">Choisir un statut…</option>
                  {['Nouveau', 'Pris en charge', 'En attente RC', 'Résolu', 'Réouvert'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
            ))
          ) : (
            <label>
              Statut par défaut
              <select
                value={defaults.status}
                onChange={(e) => setDefaults({ ...defaults, status: e.target.value })}
              >
                <option value="">Choisir…</option>
                {['Nouveau', 'Pris en charge', 'En attente RC', 'Résolu', 'Réouvert'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <div className="form-grid">
            <label>
              Origine si absente
              <select
                value={defaults.origin}
                onChange={(e) => setDefaults({ ...defaults, origin: e.target.value })}
              >
                <option>Transport</option>
                <option>Interne</option>
              </select>
            </label>
            <label>
              Type si absent
              <input
                value={defaults.type}
                onChange={(e) => setDefaults({ ...defaults, type: e.target.value })}
              />
            </label>
          </div>
          <div className="modal-footer">
            <button className="secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={15} />
              Changer de fichier
            </button>
            <button
              className="primary"
              disabled={
                (!map.title && !map.order && !map.externalId) ||
                !map.created ||
                !defaults.sourceList.trim()
              }
              onClick={() => setStep(3)}
            >
              Vérifier les dossiers
              <ArrowRight size={15} />
            </button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <div className="import-message">
            <b>{preview.length} dossiers analysés</b> ·{' '}
            {preview.filter((p) => p.record.status === 'Résolu').length} résolus ·{' '}
            {preview.filter((p) => p.record.status !== 'Résolu').length} en cours
            <br />
            {errors.length} lignes en erreur · {warnings.length} lignes avec informations
            incomplètes.
            <br />
            Les doublons seront ignorés. Aucun dossier existant ne sera remplacé.
          </div>
          <div className="import-preview">
            <table>
              <thead>
                <tr>
                  <th>Ligne</th>
                  <th>Dossier</th>
                  <th>Statut</th>
                  <th>Contrôle</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 200).map((p) => (
                  <tr key={p.line}>
                    <td>{p.line}</td>
                    <td>{p.record.title || 'Sans objet'}</td>
                    <td>{p.record.status || 'Non reconnu'}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 220 }}>
                      {p.errors.length ? (
                        <span style={{ color: '#bd7377' }}>{p.errors.join(' · ')}</span>
                      ) : p.warnings.length ? (
                        <span style={{ color: '#b69a66' }}>{p.warnings.join(' · ')}</span>
                      ) : (
                        <span style={{ color: '#6da28b' }}>Prêt à importer</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 200 && (
            <p className="muted">
              Aperçu des 200 premières lignes ; toutes les lignes sont contrôlées.
            </p>
          )}
          {errors.length > 0 && (
            <div className="error">
              Corrigez les colonnes ou les données du fichier. Aucune ligne ne sera importée tant
              qu’il reste une erreur.
            </div>
          )}
          <div className="import-message">
            Les colonnes non reconnues sont conservées dans chaque dossier sous « Données source ».
            Les commentaires historiques sont repris comme notes de migration, sans attribuer de
            faux auteurs. Les qualifications manquantes restent signalées. Un dossier résolu sans
            date de clôture est conservé et exclu du calcul des délais.
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            J’ai vérifié les correspondances, les dates, les valeurs par défaut et les informations
            incomplètes.
          </label>
          <div className="modal-footer">
            <button disabled={busy} className="secondary" onClick={() => setStep(2)}>
              <ArrowLeft size={15} />
              Revoir les colonnes
            </button>
            <button
              disabled={busy || !!errors.length || !accepted}
              className="primary"
              onClick={confirm}
            >
              <Upload size={16} />
              {busy ? 'Importation en cours…' : 'Importer ' + preview.length + ' dossiers'}
            </button>
          </div>
          <small className="muted">
            Import par lots de 50. En cas d’interruption, réimporter le même fichier ignore les
            dossiers déjà repris.
          </small>
        </>
      )}
      {step === 4 && done && (
        <div className="import-zone">
          <Check size={35} />
          <h3>Import terminé le {dateTime(done.at)}</h3>
          <p>
            {done.imported} dossiers importés · {done.skipped} doublons ignorés
          </p>
          <p>Les dossiers sont disponibles avec leur statut et leur historique de migration.</p>
        </div>
      )}
      {error && (
        <div role="alert" className="error">
          <AlertCircle size={17} />
          {error}
        </div>
      )}
    </>
  );
}
