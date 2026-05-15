/**
 * B2B “factory credentials” — stored in `badge_text` as comma-separated English labels.
 * Filter matches if `badge_text` (case-insensitive) contains any of the `match` substrings.
 */
export const FACTORY_CREDENTIAL_FILTERS = [
  {
    id: 'industry-leader',
    label: 'Industry Leader',
    match: ['industry leader', 'industry-leader', '行业龙头', '标杆工厂'],
  },
  {
    id: 'export-experience',
    label: 'Export Experience',
    match: ['export experience', 'export-experience', '出口经验', '外贸厂'],
  },
  {
    id: 'iso-9001',
    label: 'ISO 9001 Certified',
    match: ['iso 9001', 'iso9001', 'iso-9001'],
  },
  {
    id: 'oem-odm',
    label: 'OEM/ODM Specialist',
    match: ['oem/odm', 'oem-odm', 'oem', 'odm specialist', '代工'],
  },
  {
    id: 'trade-assurance',
    label: 'Trade Assurance',
    match: ['trade assurance', 'trade-assurance', '信保'],
  },
  {
    id: 'fast-turnaround',
    label: 'Fast Turnaround',
    match: ['fast turnaround', 'fast-turnaround', '交期快', '快反'],
  },
] as const;

export type FactoryCredentialId = (typeof FACTORY_CREDENTIAL_FILTERS)[number]['id'];

export const FACTORY_CREDENTIAL_IDS: FactoryCredentialId[] = FACTORY_CREDENTIAL_FILTERS.map(
  (f) => f.id
);

/** Credential tag ids present on this factory (for filter chips). */
export function credentialIdsFromBadgeText(badgeText: string | null | undefined): FactoryCredentialId[] {
  const hay = (badgeText || '').toLowerCase();
  const out: FactoryCredentialId[] = [];
  for (const f of FACTORY_CREDENTIAL_FILTERS) {
    if (f.match.some((m) => hay.includes(m.toLowerCase()))) {
      out.push(f.id);
    }
  }
  return out;
}
