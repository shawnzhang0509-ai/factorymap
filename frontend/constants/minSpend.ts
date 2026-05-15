/** @deprecated Import MOQ / factory constants from `../constants/moqTiers` and `../constants/factoryCredentials`. */
export { MOQ_TIER_FORM_OPTIONS } from './moqTiers';
import { normalizeMoqStored } from './moqTiers';

/** Values 1–4 = MOQ tier; legacy data → null */
export function parseMinSpend(raw: unknown): number | null {
  const t = normalizeMoqStored(raw);
  return t === 0 ? null : t;
}
