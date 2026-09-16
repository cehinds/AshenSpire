# Enemy combat states

Issue #824. Each of the 33 approved idle sprites is the reference for one eight-cell sheet. The first cell is an idle registration seed; the other seven cells supply buffing, wounded, afflicted, projectile, guard, guarded impact and hurt poses. Existing idle and attack assets are preserved.

Run `node art/enemy-states/build.mjs` from the repository root to rebuild all 231 transparent 384×384 sprites, their manifest, and `src/content/enemyStateArt.js`. Generated checkerboard backgrounds are masked before gutters are detected. One scale is shared by all poses of an enemy, with a common foot line at 364. Display scale registers the sheet's idle seed to the approved idle, preserving headroom for raised weapons.

Open `/art/enemy-states/index.html` on the development server to compare all poses and exercise the same pose stage and buff aura logic used in combat.

Combat presentation prioritizes guarding while Block remains, then an active negative status, then wounded at 35% HP or less. Hurt is a short reaction to HP damage; guarded impact is a short reaction to damage fully absorbed by Block. Projectile or spell attacks use the projectile pose. Buff and debuff actions use the buffing gesture. These are visual choices and do not change combat mechanics.

Active buffs color the sprite silhouette by theme. Multiple themes combine. Zero-stack effects and buildup meters do not glow; harmful statuses select the afflicted pose rather than a positive aura. The existing status icons and tooltips continue to identify the effects without relying on color. Pose changes remain readable with reduced motion, while the combat motion CSS suppresses movement.
