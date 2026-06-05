import { PALETTES, type PaletteKey } from './palettes';
import { STYLES, type StyleKey } from './styles';
import { DENSITES, type DensiteKey } from './densites';

export interface ThemeOptions {
  palette: PaletteKey;
  style: StyleKey;
  densite: DensiteKey;
}

export function applyTheme({ palette, style, densite }: ThemeOptions) {
  const vars = { ...PALETTES[palette], ...STYLES[style], ...DENSITES[densite] };
  const css = `:root {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
  const el = document.getElementById('ms-theme');
  if (el) el.textContent = css;
}
