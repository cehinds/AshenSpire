// One profile-backed start at a time. A storage wait must never replace a
// newer surface or run after the player has left the initiating screen.
export function createRunStartOwner() {
  let pending = null;
  return {
    start({ prepare, isCurrent, adopt, onFailure }) {
      if (pending) return pending;
      pending = (async () => {
        try {
          const prepared = await prepare();
          if (!isCurrent()) return { ok: false, cancelled: true };
          if (!prepared?.ok) throw new Error(prepared?.reason || 'Profile storage refused the new run.');
          await adopt();
          return { ok: true };
        } catch (error) {
          if (isCurrent()) onFailure(error);
          return { ok: false, reason: error.message };
        } finally {
          pending = null;
        }
      })();
      return pending;
    },
  };
}
