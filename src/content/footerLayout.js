import { uiConfig } from '../config/generated/ui.js';

// Authored by Footer Atelier. Art IDs are fixed; text and geometry stay data.
export const footerLayout = uiConfig.presentation.footerLayout.components.layout;
export const footerSizing = uiConfig.presentation.footerLayout.sizing;
export const footerAssets = Object.fromEntries(['plate', 'draw', 'spent-cards', 'potions', 'connector']
  .map(id => [id, `assets/ui/footer/${id}.webp`]));
export const footerFonts = { serif: 'Georgia, serif', sans: 'Arial, sans-serif', mono: 'monospace' };
