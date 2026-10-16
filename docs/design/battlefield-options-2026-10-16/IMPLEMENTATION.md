# Approved battlefield implementation

The revised original layout and actual-art preview were approved, followed by a 50% larger player and independently 50% larger combatant mini HUDs. The main header keeps the approved scale.

The authored source is `content/config/ui/presentation/combatFormationModel.json`. The four visual depth bands are A enemy back (top-right anchor), B enemy front (bottom-left), C extra combatants, D player (bottom-center, default leftmost lane). C uses a rightward anchor so a real occupant remains visible beside the larger player. All four bands retain their outer geometry when C occupancy is disabled. Core disables occupancy; current enables it through the formation module. These bands are independent of saved gameplay lane/cell letters: a rendered C occupant can have saved address A5.

The renderer consumes the engine's actual formation policy and actor occupancy, including restored player lanes and Classic-column compatibility. It does not invent or redistribute occupied cells. Player art uses its own fit multiplier, separately from HUD sizing. At 1440×900 the requested player measures approximately 212.6×225.6 physical pixels; player mini HUD approximately 201.6×61.2. The enemy meter target is 156×28.5. On narrow screens enemy HUD width is capped by the actual sheared cell width, with the original readable minimum retained.

The existing centered hand and footer controls retain their order and appearance. The footer art is uniformly enlarged; its outer background is transparent against the continuous lower HUD color. Combat log and Reaction controls anchor to the combat root's edges above the hand area, independent of card count or fan width. Compact rule text stays inside its authored parchment and remains fully readable through Inspect.

The scene canvas keeps its native proportions and device-specific painting. The desktop camera exposes more sky; the narrow fit also covers the complete field so every character stands on actual scenery. Shadows use the visible figure envelope rather than the health bar width.

Validation uses actual source gameplay fixtures, not the frozen design prototype: `index.html?shot=combat`, and `?shot=combat&shotEnemyCount=7&gameProfile=current` or `core`. The original `visual-preview.html` remains a non-playable design reference with engine scripts removed. Production checks include formation/model/config tests, core/current actual occupancy, restored cell mapping, browser geometry at desktop/wide/tablet/phone sizes, and real Inspect/target interactions.
