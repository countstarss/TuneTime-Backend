const truthyValues = new Set(['1', 'true', 'yes', 'on']);

export function isDevMvpRelaxationEnabled(): boolean {
  const raw = process.env.DEV_MVP_RELAXATIONS_ENABLED;

  if (!raw) {
    return false;
  }

  return truthyValues.has(raw.trim().toLowerCase());
}
