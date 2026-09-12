// Proposed presentation reference. These defaults do not define shipped progression rules.
import { buttonWidths } from './button-widths.mjs';
export const progressionConfig = {
  categories: ['weapons', 'skills'], categoryIds: { weapons: 'weapons', skills: 'skills' }, defaultCategory: 'weapons',
  showLockedTechniques: true, showHistory: true, allowPreviewAward: true,
  previewAward: 12, progressMinimum: 0, progressMaximum: 100,
  labels: { title: 'Proficiencies', back: 'Back', award: 'Preview progress' },
  layout: { width: 'min(95vw, 68rem)', height: 'min(90vh, 48rem)', inset: '1rem', gap: '.75rem', sidebar: 'minmax(0, 1fr)', list: 'minmax(0, 1fr)', detail: 'minmax(0, 2fr)', meterHeight: '.6rem', compactBreakpoint: '42rem', standardButtonHeight: buttonWidths.standardHeight, tileHeightMultiplier: buttonWidths.heightMultipliers.double, categoryButtonSize: 'full-standard', tileButtonSize: 'full-double' },
  colors: { background: '#241c13', inset: '#19140e', text: '#efe5d4', muted: '#c1ad8b', gold: '#d1aa60', progress: '#4189b6', primary: '#557b3f', danger: '#ac4e3c' }
};
export const progressionSamples = [
  { id: 'swords', category: 'weapons', name: 'Swords', rank: 3, progress: 42, required: 100, description: 'Practice with sword techniques.', next: 'Next sword technique becomes available for review.', techniques: [{ name: 'Measured cut', known: true }, { name: 'Guard break', known: false }], history: ['Last encounter: sword practice recorded.'] },
  { id: 'bows', category: 'weapons', name: 'Bows', rank: 2, progress: 68, required: 100, description: 'Practice with aimed attacks.', next: 'Next bow technique becomes available for review.', techniques: [{ name: 'Steady aim', known: true }, { name: 'Piercing shot', known: false }], history: ['Last encounter: bow practice recorded.'] },
  { id: 'restoration', category: 'skills', name: 'Restoration', rank: 2, progress: 35, required: 100, description: 'Practice with restorative skills.', next: 'Next restoration technique becomes available for review.', techniques: [{ name: 'Mend', known: true }, { name: 'Renew', known: false }], history: ['Last encounter: restoration practice recorded.'] },
  { id: 'guarding', category: 'skills', name: 'Guarding', rank: 1, progress: 80, required: 100, description: 'Practice with defensive skills.', next: 'Next defensive technique becomes available for review.', techniques: [{ name: 'Brace', known: true }, { name: 'Counterguard', known: false }], history: ['Last encounter: defensive practice recorded.'] }
];
const freeze = value => { Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child); }); return Object.freeze(value); };
freeze(progressionConfig); freeze(progressionSamples);
export const progressionSourceReferences = {
  existing: ['src/ui/screens/equipment.js', 'src/ui/components/equipmentCard.js', 'src/ui/components/modalShell.js', 'src/ui/components/resbars.js'],
  proposal: 'PROGRESSION-SPECIFICATION.md',
  description: 'The existing equipment screen, equipment cards, modal shell and meters are source references for presentation reuse. Per-weapon and per-skill practice progression is proposed; these sample ranks, names and awards are illustrative, not shipped mechanics.'
};
const workspace = `┌──────────────────────────────────────────────────────────────────────────┐
│ Proficiencies                                                        [×] │
├──────────────────┬──────────────────┬────────────────────────────────────┤
│ [    Weapons   ] │ ┌──────────────┐ │ Swords                      Rank 3 │
│ [    Skills    ] │ │ Swords     3 │ │ [████████░░░░░░░░░░░░░░]    42/100 │
│                  │ │ [██░] 42/100 │ │ Next benefit                       │
│                  │ └──────────────┘ │ Known techniques                   │
│                  │ ┌──────────────┐ │ Recent practice                    │
│                  │ │ Bows       2 │ │                                    │
│                  │ │ [██░] 68/100 │ │                                    │
│                  │ └──────────────┘ │                                    │
├──────────────────┴──────────────────┴────────────────────────────────────┤
│ [                                 Back                                 ] │
└──────────────────────────────────────────────────────────────────────────┘`;
export const progressionPortraitDiagram = `┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords            Rank 3  │
│ [████░░░░░░]      42/100  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘`;
const compose = `INPUT character knowledge, progression projection, config.progression
// Category and proficiency selection are presentation state, not progression mutations.
category = ResolveCategoryOrDefault(config.progression.categories, config.progression.defaultCategory)
entries = ProjectKnownProficiencies(character, category)
selected = ResolveStableSelection(entries)
ComposeW1Shell(title=config.progression.labels.title)
// Columns share a top anchor; category buttons and tiles never stretch to fill height.
SetCategoryButtonHeight(config.progression.layout.standardButtonHeight)
SetTileHeight(config.progression.layout.standardButtonHeight * config.progression.layout.tileHeightMultiplier)
SetColumnTracks(config.progression.layout.sidebar, config.progression.layout.list, config.progression.layout.detail)
// Category and tile tracks have equal width and equal horizontal insets.
UseUniformWidthWithinEachColumn(); UseSharedColumnInset(config.progression.layout.inset)
AlignColumnsToTop(); SeparateColumnsWithVerticalRules()
Compose(WGP1, entries); Compose(WGP2, selected); Compose(WGP3, selected); Compose(WGP4, selected)
// Compact hosts replace navigation columns with dropdowns; retain the same selected ID.
AdaptNavigationToHost(config.progression.layout.compactBreakpoint)
RenderOnlyKnownBenefitsAndTechniques(character.knowledge)
If config.progression.showHistory: RenderOrderedPracticeEvents(selected)
// Back is the sole production footer command and therefore fills the footer.
Compose(WCB4, width=AvailableFooterWidth())
// Preview award is outside the game frame and changes only cloned fixture state.
If config.progression.allowPreviewAward: ExposePreviewAward(config.progression.previewAward)
// Each viewport gets isolated preview state; controls stay outside the game frame.
instance = ClonePresentationState(config.progression)
ExposeInstanceControls(instance.showLockedTechniques, instance.showHistory, instance.previewAward)
OnPreviewControlChange: ReprojectOnlyThisInstance(instance)
OnResetPreview: RestoreThisInstanceDefaults(config.progression)`;
// Tuple contract: ID, name, parent, diagram, uses, anchor, width, height, pseudocode.
export const progressionDefinitions = [
  ['W1x','Proficiencies','W1',workspace,'Character profile and post-combat progression review','W0 title/exit/footer anchors','config.progression.layout.width','config.progression.layout.height',compose],
  ['W1x1','Weapon proficiency','W1x',workspace,'Weapons category; same workspace model','W1x active body','parent body width','parent body height',compose + '\nSelectCategory(config.progression.categoryIds.weapons) // Bind configured category ID, not a mechanics rule.'],
  ['W1x2','Skill proficiency','W1x',workspace,'Skills category; same workspace model','W1x active body','parent body width','parent body height',compose + '\nSelectCategory(config.progression.categoryIds.skills) // Bind configured category ID, not a mechanics rule.'],
  ['WGP0','Progression components','WCF0','[WGP1 list] → [WGP2 progress]\n               [WGP4 next benefit]\n               [WGP3 techniques]','Shared weapon and skill progression','W1 active body','available width','content fit','INPUT projection, config.progression\n// Children consume the same selected proficiency ID.\nComposeRegisteredChildren(projection, config.progression.layout)'],
  ['WGP1','Proficiency list row','WCF1','┌───────────────────────────────┐\n│ Name                   Rank 3 │\n│ [████░░░░░░░░]         42/100 │\n└───────────────────────────────┘','Weapon and skill navigation; links WCI1, WGP2; same tile contract in every profile','top aligned; name inline-start and rank inline-end; progress directly below','available list-column width, uniform across all tiles','config.progression.layout.standardButtonHeight * config.progression.layout.tileHeightMultiplier','INPUT proficiency summary, selected ID, config.progression\n// Preserve stable selection across categories and host sizes.\ntileHeight = config.progression.layout.standardButtonHeight * config.progression.layout.tileHeightMultiplier\nSetUniformTileSize(width=AvailableListColumnWidth(), height=tileHeight)\nRenderInlineNameAndRank(WCI1, summary, alignName=InlineStart(), alignRank=InlineEnd())\n// The next row is a single inline meter/value component, with no extra subtitle.\nComposeBelow(WGP2, summary)\nOnActivate: SelectProficiency(summary.id)'],
  ['WGP2','Proficiency progress','WCM2','[████████░░░░░░░░]  42/100','List rows, details and award preview; same inline meter/value layout in wide, compact, SE and S24','meter inline-start and fraction inline-end; vertically centered within the same row','available row width; meter takes remaining width after fraction and shared gap','row content-fit; bar thickness=config.progression.layout.meterHeight','INPUT accumulated practice, threshold, config.progression\n// Domain projection supplies values; renderer does not award progression.\nfraction = SafeProgressFraction(accumulatedPractice, threshold)\nComposeInlineRow(gap=config.progression.layout.gap)\nRenderSharedMeter(WCM2, fraction, config.progression.colors.progress, thickness=config.progression.layout.meterHeight, width=RemainingRowWidth())\nRenderFractionAtInlineEnd(accumulatedPractice, threshold)\n// No Practice subtitle: the fraction and accessible label already identify progress.\nProvideAccessibleValueText(accumulatedPractice, threshold)'],
  ['WGP3','Known techniques','WCF4','Known techniques\nMeasured cut       Available\nGuard break        Undiscovered','Knowledge-filtered proficiency details','aligned label/value columns','available detail width','content fit','INPUT technique unlock projection, knowledge, config.progression\n// Unknown mechanics must not leak through tooltips or source-backed view data.\nrows = ApplyKnowledgeFilter(techniques, knowledge)\nIf config.progression.showLockedTechniques: AppendGenericUnknownRows()\nRenderFactRows(WCF4, rows)'],
  ['WGP4','Next proficiency benefit','WCF4','Next benefit\n{Known benefit or undiscovered} ','Weapon and skill progression details','start aligned in detail stack','available detail width','content fit','INPUT next threshold projection, knowledge, config.progression\n// Threshold effects are data references; avoid invented growth formulas.\nbenefit = ProjectKnownBenefitOrUnknown(nextThreshold, knowledge)\nRenderFactRows(WCF4, benefit)']
];
