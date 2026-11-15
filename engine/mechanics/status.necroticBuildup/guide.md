# Necrotic build-up (`status.necroticBuildup`)
When the build-up reaches the holder's current HP, it dies at the end of its own turn, bosses included. Only added by a necrotic hit while its Poise is broken. Lasts the whole fight.
- Carried by: statuses on any entity.
- Lives in: `src/engine/elementIdentity.js` (`ApplyElementReceipt`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
