// Words that would turn marketing follow-up into an insurance decision.
export const DECISION_LANGUAGE_TERMS = [
  'quote',
  'quotes',
  'price',
  'prices',
  'pricing',
  'premium',
  'premiums',
  'rate',
  'rates',
  'savings',
  'save',
  'eligible',
  'eligibility',
  'approved for coverage',
  'underwriting',
  'underwrite',
  'guarantee',
  'guaranteed',
  'risk',
] as const;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const decisionPatterns = DECISION_LANGUAGE_TERMS.map((term) => ({
  term,
  pattern: new RegExp(
    `\\b${escapeRegExp(term).replace(/ /gu, '\\s+')}\\b`,
    'iu',
  ),
}));

export function findDecisionLanguage(text: string): string[] {
  return decisionPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ term }) => term);
}
