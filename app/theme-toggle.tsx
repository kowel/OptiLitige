'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

// Bouton Apparence (en haut à droite) : mode Clair / Sombre / Auto, et pour chaque mode la
// variante préférée de l'agent (clair Violet ou Ardoise, sombre Minuit ou Graphite).
// Les choix sont retenus par le navigateur ; « Auto » suit le réglage de Windows. Ils sont
// appliqués avant l'affichage par le petit script de app/layout.tsx (pas d'éclair au chargement).
// Couleurs des variantes : app/theme-variants.generated.css (pnpm run theme:dark).
export type ThemeChoice = 'auto' | 'light' | 'dark';
export type LightVariant = 'violet' | 'ardoise';
export type DarkVariant = 'minuit' | 'graphite';
const KEY = 'optilitige-theme';
const LIGHT_KEY = 'optilitige-light';
const DARK_KEY = 'optilitige-dark';

const MODES: { id: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Clair', Icon: Sun },
  { id: 'dark', label: 'Sombre', Icon: Moon },
  { id: 'auto', label: 'Auto', Icon: Monitor },
];
// Aperçu de chaque variante : fond, menu, accent
const LIGHTS: { id: LightVariant; label: string; hint: string; colors: string[] }[] = [
  {
    id: 'violet',
    label: 'Violet',
    hint: 'Les couleurs d’OptiLitige',
    colors: ['#f5f7fc', '#1c2441', '#7052de'],
  },
  {
    id: 'ardoise',
    label: 'Ardoise',
    hint: 'Gris-bleu sobre, accent indigo',
    colors: ['#f5f6f8', '#272b36', '#4b58c4'],
  },
];
const DARKS: { id: DarkVariant; label: string; hint: string; colors: string[] }[] = [
  {
    id: 'minuit',
    label: 'Minuit',
    hint: 'Bleu nuit profond',
    colors: ['#0b1122', '#131b33', '#8ea4ff'],
  },
  {
    id: 'graphite',
    label: 'Graphite',
    hint: 'Gris anthracite, accent violet',
    colors: ['#121316', '#1b1c20', '#a594ff'],
  },
];

// Change les couleurs avec un fondu. Rien ne bouge si rien ne change, ni si la page est cachée
// ou que Windows demande de réduire les animations.
function withFade(set: () => void) {
  if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return set();
  // Fondu enchaîné de toute la page (Edge, Chrome) : dégradés et ombres compris
  type Transition = { ready: Promise<void>; finished: Promise<void> };
  const doc = document as Document & { startViewTransition?: (update: () => void) => Transition };
  if (doc.startViewTransition) {
    try {
      const t = doc.startViewTransition(set);
      // Fondu interrompu (page cachée pendant l'animation…) : le thème est appliqué quand même
      const ignore = () => {};
      t?.ready?.catch(ignore);
      t?.finished?.catch(ignore);
    } catch {
      set();
    }
    return;
  }
  // Autres navigateurs : transition des couleurs, retirée après le fondu
  const root = document.documentElement;
  root.classList.add('theme-fading');
  set();
  window.setTimeout(() => root.classList.remove('theme-fading'), 500);
}

function apply(choice: ThemeChoice, light: LightVariant, dark: DarkVariant) {
  const root = document.documentElement;
  const isDark =
    choice === 'dark' ||
    (choice === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = isDark ? 'dark' : 'light';
  const l = light === 'ardoise' ? 'ardoise' : undefined;
  const d = dark === 'graphite' ? 'graphite' : undefined;
  if (root.dataset.theme === next && root.dataset.light === l && root.dataset.dark === d) return;
  withFade(() => {
    root.dataset.theme = next;
    if (l) root.dataset.light = l;
    else delete root.dataset.light;
    if (d) root.dataset.dark = d;
    else delete root.dataset.dark;
  });
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // navigation privée : le choix vaut pour la page ouverte
  }
}

type Prefs = { mode: ThemeChoice; light: LightVariant; dark: DarkVariant };
function stored(): Prefs {
  const m = read(KEY);
  return {
    mode: m === 'light' || m === 'dark' ? m : 'auto',
    light: read(LIGHT_KEY) === 'ardoise' ? 'ardoise' : 'violet',
    dark: read(DARK_KEY) === 'graphite' ? 'graphite' : 'minuit',
  };
}

function Swatch({ colors }: { colors: string[] }) {
  return (
    <span className="appearance-swatch" aria-hidden="true">
      <span style={{ background: colors[0] }} />
      <span style={{ background: colors[1] }} />
      <span style={{ background: colors[2] }} />
    </span>
  );
}

export default function ThemeToggle() {
  // Rien tant que les choix enregistrés ne sont pas lus (le thème est déjà appliqué par
  // layout.tsx) : appliquer les valeurs par défaut en attendant ferait un aller-retour au chargement
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const current: Prefs = prefs ?? { mode: 'auto', light: 'violet', dark: 'minuit' };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture des choix après le rendu serveur
    setPrefs(stored());
  }, []);
  useEffect(() => {
    if (!prefs) return;
    apply(prefs.mode, prefs.light, prefs.dark);
    if (prefs.mode !== 'auto') return;
    // En automatique, suivre Windows en direct (passage jour / nuit)
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => apply('auto', prefs.light, prefs.dark);
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, [prefs]);
  // Fermeture : clic à côté ou Échap
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const change = (patch: Partial<Prefs>) => {
    const next = { ...current, ...patch };
    setPrefs(next);
    save(KEY, next.mode);
    save(LIGHT_KEY, next.light);
    save(DARK_KEY, next.dark);
  };
  const ModeIcon = MODES.find((m) => m.id === current.mode)!.Icon;
  return (
    <span className="appearance" ref={box}>
      <button
        type="button"
        className="icon-btn theme-toggle"
        aria-label="Apparence : mode clair ou sombre et couleurs"
        aria-expanded={open}
        title="Apparence (clair, sombre, couleurs)"
        onClick={() => setOpen(!open)}
      >
        <ModeIcon size={18} />
      </button>
      {open && (
        <div className="appearance-menu" role="dialog" aria-label="Apparence">
          <strong>Apparence</strong>
          <div className="appearance-modes" role="radiogroup" aria-label="Mode">
            {MODES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={current.mode === id}
                className={current.mode === id ? 'active' : ''}
                onClick={() => change({ mode: id })}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          {current.mode === 'auto' && (
            <small className="appearance-note">
              Auto suit le réglage clair / sombre de Windows.
            </small>
          )}
          <span className="appearance-title">Couleurs en mode clair</span>
          {LIGHTS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={current.light === v.id}
              className={'appearance-option' + (current.light === v.id ? ' active' : '')}
              onClick={() => change({ light: v.id })}
            >
              <Swatch colors={v.colors} />
              <span>
                <b>{v.label}</b>
                <small>{v.hint}</small>
              </span>
              {current.light === v.id && <Check size={15} />}
            </button>
          ))}
          <span className="appearance-title">Couleurs en mode sombre</span>
          {DARKS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={current.dark === v.id}
              className={'appearance-option' + (current.dark === v.id ? ' active' : '')}
              onClick={() => change({ dark: v.id })}
            >
              <Swatch colors={v.colors} />
              <span>
                <b>{v.label}</b>
                <small>{v.hint}</small>
              </span>
              {current.dark === v.id && <Check size={15} />}
            </button>
          ))}
          <small className="appearance-note">Choix propre à cet ordinateur.</small>
        </div>
      )}
    </span>
  );
}
