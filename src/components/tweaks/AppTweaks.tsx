import { useEffect } from 'react';
import { TweaksPanel, TweakSection, TweakRadio } from './TweaksPanel';
import { useTweaks } from '../../hooks/useTweaks';
import { PALETTES, type PaletteKey } from '../../theme/palettes';
import { applyTheme } from '../../theme/applyTheme';
import type { StyleKey } from '../../theme/styles';
import type { DensiteKey } from '../../theme/densites';

const DEFAULTS = {
  palette: 'crepuscule' as PaletteKey,
  style:   'moderne'    as StyleKey,
  densite: 'standard'   as DensiteKey,
};

const PALETTE_OPTS: { value: PaletteKey; label: string }[] = [
  { value: 'ocean',      label: 'Océan' },
  { value: 'foret',      label: 'Forêt' },
  { value: 'crepuscule', label: 'Crépuscule' },
  { value: 'ardoise',    label: 'Ardoise' },
];
const STYLE_OPTS:   { value: StyleKey;   label: string }[] = [
  { value: 'moderne',    label: 'Moderne' },
  { value: 'epure',      label: 'Épuré' },
  { value: 'chaleureux', label: 'Chaleureux' },
];
const DENSITE_OPTS: { value: DensiteKey; label: string }[] = [
  { value: 'compact',  label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'aere',     label: 'Aéré' },
];

export function AppTweaks() {
  const [t, setTweak] = useTweaks(DEFAULTS);

  useEffect(() => { applyTheme(t); }, []);

  const set = (key: keyof typeof DEFAULTS, value: string) => {
    setTweak(key, value as never);
    applyTheme({ ...t, [key]: value });
  };

  return (
    <TweaksPanel>
      <TweakSection label="Palette de couleurs" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {PALETTE_OPTS.map((opt) => {
          const p = PALETTES[opt.value];
          const active = t.palette === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => set('palette', opt.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? `${p['--ms-accent']}18` : 'rgba(0,0,0,0.04)',
                outline: active ? `2px solid ${p['--ms-accent']}` : '2px solid transparent',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ width: 10, height: 22, borderRadius: '3px 0 0 3px', background: p['--ms-sidebar'] }} />
                <div style={{ width: 10, height: 22, borderRadius: '0 3px 3px 0', background: p['--ms-accent'] }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#29261b' }}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <TweakSection label="Style de l'interface" />
      <TweakRadio label="" value={t.style} options={STYLE_OPTS} onChange={(v) => set('style', v)} />
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, padding: '0 2px', marginTop: -4 }}>
        {t.style === 'moderne'    && '↳ Coins arrondis, ombres légères'}
        {t.style === 'epure'      && '↳ Angles vifs, bordures seulement'}
        {t.style === 'chaleureux' && '↳ Gros rayons, ombres douces'}
      </div>

      <TweakSection label="Densité d'affichage" />
      <TweakRadio label="" value={t.densite} options={DENSITE_OPTS} onChange={(v) => set('densite', v)} />
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, padding: '0 2px', marginTop: -4 }}>
        {t.densite === 'compact'  && "↳ Information dense, gain d'espace"}
        {t.densite === 'standard' && '↳ Équilibre confort / densité'}
        {t.densite === 'aere'     && '↳ Espacement généreux, respiration'}
      </div>
    </TweaksPanel>
  );
}
