import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { APPEARANCE_KEY, DEFAULT_APPEARANCE, PALETTES, isHex, palette, readAppearance, type Appearance } from './palette';
import { Icon } from './Icon';
import { Section } from './Display';
import { Segmented } from './Fields';

function load(): Appearance {
  try { return readAppearance(localStorage.getItem(APPEARANCE_KEY)); } catch { return { ...DEFAULT_APPEARANCE }; }
}
export function applyAppearance(a: Appearance) {
  const dark = a.mode === 'dark' || (a.mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  Object.entries(palette(a.accent, dark)).forEach(([key, value]) => root.style.setProperty(key, value));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e151b' : '#f3f5f6');
}
// Appliqué avant le premier rendu pour éviter un flash du mauvais thème.
export function initializeAppearance() { applyAppearance(load()); }
const Context = createContext<{ appearance: Appearance; setAppearance: (a: Appearance) => void; saved: boolean } | null>(null);
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setValue] = useState(load);
  const [saved, setSaved] = useState(true);
  function setAppearance(a: Appearance) {
    setValue(a); applyAppearance(a);
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(a)); setSaved(true); } catch { setSaved(false); }
  }
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyAppearance(appearance);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, [appearance]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === APPEARANCE_KEY || e.key === null) { const a = readAppearance(e.newValue); setValue(a); applyAppearance(a); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return <Context.Provider value={{ appearance, setAppearance, saved }}>{children}</Context.Provider>;
}
export function AppearanceSettings() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('AppearanceProvider manquant');
  const { appearance: a, setAppearance, saved } = ctx;
  const [hex, setHex] = useState(a.accent);
  useEffect(() => setHex(a.accent), [a.accent]);
  const invalid = !isHex(hex);
  const selected = PALETTES.find(p => p.color === a.accent)?.name ?? 'Sur mesure';
  function color(accent: string) { setAppearance({ ...a, accent: accent.toLowerCase() }); }
  return <Section title="Apparence" icon="sparkles" className="appearance-section">
    <p className="field-hint">Un espace à votre image. Les changements sont immédiats.</p>
    <div className="appearance-preview" aria-hidden="true">
      <div className="preview-top"><Icon name="building" size={20} /><span>MON BIEN LOCATIF</span><span className="preview-dot" /></div>
      <div className="preview-title">Votre patrimoine.<br /><span>Votre signature.</span></div>
      <div className="preview-bottom"><span>{selected}</span><span>APERÇU</span></div>
      <svg className="preview-lines" viewBox="0 0 160 160" fill="none"><path d="M20 120V50L80 18l60 32v70l-60 32-60-32Zm0-70 60 32 60-32M80 82v70M40 61v70M60 72v70M100 72v70M120 61v70M20 76l60 32 60-32M20 102l60 32 60-32" stroke="currentColor" /></svg>
    </div>
    <div className="appearance-field"><span className="appearance-label">Ambiance</span>
      <Segmented label="Ambiance" value={a.mode} onChange={mode => setAppearance({ ...a, mode })} options={[
        { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }, { value: 'system', label: 'Auto' },
      ]} />
      <p className="field-hint">Auto suit le thème de votre appareil.</p>
    </div>
    <div className="appearance-field"><span className="appearance-label">Couleur signature <span>{selected}</span></span>
      <div className="palette-grid" role="group" aria-label="Palettes de couleurs">{PALETTES.map(p =>
        <button type="button" key={p.name} className="palette-choice" aria-pressed={a.accent === p.color} onClick={() => color(p.color)}>
          <span className="palette-swatch" style={{ '--swatch': p.color } as CSSProperties}>{a.accent === p.color && <Icon name="check" size={18} />}</span><span>{p.name}</span>
        </button>)}
      </div>
    </div>
    <div className="custom-color-row">
      <label className="color-picker-label"><input type="color" aria-label="Choisir une couleur personnalisée" value={a.accent} onChange={e => color(e.target.value)} /><span>Sur mesure</span></label>
      <label className="hex-label"><span className="sr-only">Code couleur hexadécimal</span><input className="text-input" aria-label="Code couleur hexadécimal" aria-invalid={invalid || undefined} aria-describedby="color-help" value={hex} maxLength={7} spellCheck={false} onChange={e => { setHex(e.target.value); if (isHex(e.target.value)) color(e.target.value); }} /></label>
    </div>
    <p id="color-help" className="field-hint">{invalid ? 'Utilisez un code comme #4268B0.' : 'Les nuances s’adaptent pour garder les textes lisibles.'}</p>
    <div className="appearance-footer"><span role="status">{saved ? 'Préférences conservées sur cet appareil' : 'Thème appliqué, mais non conservé par ce navigateur'}</span><button type="button" className="link-btn" onClick={() => setAppearance({ ...DEFAULT_APPEARANCE })}>Réinitialiser</button></div>
  </Section>;
}
