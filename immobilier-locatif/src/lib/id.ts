/** Identifiant unique local (pas besoin de crypto forte : les données ne quittent pas l'appareil). */
export function newId(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix ? `${prefix}-${rnd}` : rnd;
}
