// Percentages are relative to the containing action region, not the browser.
export const buttonWidths = {
  standardHeight: '2.75rem',
  heightMultipliers: { standard: 1, tall: 1.5, double: 2 },
  sizes: Object.fromEntries(['third','half','full'].flatMap(width => ['standard','tall','double'].map(height => [width+'-'+height,{width,height}]))),
  presets: { quarter: 25, third: 30, half: 50, full: 100 },
  choice: 'half',
  minimumReadable: '8rem',
  iconSize: '2.75rem',
  footer: 'equalSharesAfterGaps',
  singleFooter: 'full'
};
