import '../../main.js';
import { mountTooltipReview } from './tooltipReviewScene.js';
const params = new URLSearchParams(location.search);
// Require the game's existing ephemeral shot store for every review fixture.
if (params.get('shot')) await mountTooltipReview(params.get('tooltipReview') || params.get('shot'));
