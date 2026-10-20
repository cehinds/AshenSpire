// Continue points at the latest resumable descriptor, never a newer-format save.
export function loadableTitleSlots(slots) {
  return slots.filter(({ summary }) => summary && !summary.newer && summary.loadable !== false
    && !['corrupt', 'newer', 'invalid', 'blocked'].includes(summary.state))
    .sort((a, b) => String(b.summary.savedAt || '').localeCompare(String(a.summary.savedAt || '')));
}

export function profileStarterCount(starter) {
  if (!starter) return null;
  return (starter.shared || []).reduce((sum, row) => sum + row.copies, 0) + (starter.classSpecificCopies || 0);
}
