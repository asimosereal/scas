'use client';

/**
 * FLUENT 2 THEME
 * ------------------------------------------------------------------
 * Uses the official Fluent UI React v9 theme factories and layers a
 * brand palette on top via createLightTheme / createDarkTheme.
 * Colours, radii, spacing and typography all come from Fluent tokens —
 * no custom palette is invented here.
 */

import {
  createDarkTheme,
  createLightTheme,
  type BrandVariants,
  type Theme,
} from '@fluentui/react-components';

/**
 * A restrained education-blue brand ramp. Values follow Fluent's own
 * brand ramp structure (dark -> light) so tint/shade relationships stay
 * correct and every semantic colour token resolves properly.
 */
const brand: BrandVariants = {
  10: '#02050e',
  20: '#111a2e',
  30: '#152a4f',
  40: '#173465',
  50: '#184077',
  60: '#1750ab',
  70: '#145dbf',
  80: '#0f6cbd',
  90: '#2886de',
  100: '#479ef5',
  110: '#62abf5',
  120: '#77b7f7',
  130: '#96c6fa',
  140: '#b4d6fa',
  150: '#cfe4fa',
  160: '#ebf3fc',
};

export const scasLight: Theme = createLightTheme(brand);
export const scasDark: Theme = createDarkTheme(brand);
