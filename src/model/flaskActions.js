// Placement-independent action vocabulary for every flask surface. Selecting
// a flask returns this plan and never mutates state; only an explicit enabled
// action may become a local or host-authorized intent.

const FLASK_ACTION_IDS = Object.freeze(['use', 'inspect', 'drop', 'store']);
const FLASK_ACTION_CONTEXTS = Object.freeze(['combat', 'run', 'storage']);

const LABELS = Object.freeze({ use: 'Use', inspect: 'Inspect', drop: 'Drop', store: 'Store' });

function action(id, enabled, reason = '') {
  if (!FLASK_ACTION_IDS.includes(id)) throw new Error(`Unknown flask action '${id}'`);
  return Object.freeze({ id, label: LABELS[id], enabled: !!enabled, reason: enabled ? '' : String(reason || `${LABELS[id]} is unavailable`) });
}

export function flaskActionPlan({
  context,
  canUse = false,
  useReason = 'Cannot use this flask here',
  canDrop = false,
  dropReason = 'Cannot drop this flask here',
  canStore = false,
  storeReason = 'Cannot store this flask here',
} = {}) {
  if (!FLASK_ACTION_CONTEXTS.includes(context)) throw new Error(`Unknown flask action context '${context}'`);
  const actions = [action('use', canUse, useReason), action('inspect', true)];
  if (context === 'run') actions.push(action('drop', canDrop, dropReason));
  if (context === 'storage') actions.push(action('store', canStore, storeReason));
  return Object.freeze({ context, commitOnSelect: false, actions: Object.freeze(actions) });
}
