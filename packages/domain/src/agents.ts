import { z } from 'zod';
import {
  CoverageFocusSchema,
  NeedTimelineSchema,
  RequestIntentSchema,
  type IntakeSubmission,
} from './phase1.js';
import { findDecisionLanguage } from './decision-language.js';
import type { EnrichmentEvidence } from './phase2.js';

const UtcTimestampSchema = z.iso.datetime();
const IdentifierSchema = z.string().uuid();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const AGENT_VERSIONS = {
  brief: 'agent-brief-v1',
  team: 'agent-team-v1',
  rules: 'agent-rules-v1',
  prompts: 'agent-prompts-v1',
} as const;

// Owner decision 2026-10-27 (PROJECT.md § Phase 5 decisions).
export const AGENT_MODELS = {
  lead: 'claude-sonnet-5-5',
  writer: 'claude-sonnet-5-5',
  critic: 'claude-sonnet-5-5',
  worker: 'claude-haiku-5-5',
} as const;
export type AgentModel = (typeof AGENT_MODELS)[keyof typeof AGENT_MODELS];

// Costs are integer micro-dollars (1 USD = 1,000,000).
export const AGENT_LIMITS = {
  leadCapMicros: 300_000,
  processCapMicros: 8_000_000,
  maxQuestionsPerTopic: 3,
  maxClaimsPerTopic: 4,
  maxPoints: 5,
  maxRewrites: 2,
  searchesPerWorker: 3,
  paragraphMaxChars: 560,
} as const;

// Per million tokens, in micro-dollars (claude-api skill, cached 2026-10-06).
// Haiku 5.5 prompts above 100K tokens bill at the long-context rate.
export const MODEL_PRICES: Record<
  AgentModel,
  {
    input: number;
    output: number;
    longInput?: number;
    longOutput?: number;
    longAbove?: number;
  }
> = {
  'claude-sonnet-5-5': { input: 2_000_000, output: 10_000_000 },
  'claude-haiku-5-5': {
    input: 100_000,
    output: 500_000,
    longInput: 500_000,
    longOutput: 2_500_000,
    longAbove: 100_000,
  },
};
export const WEB_SEARCH_MICROS = 10_000;

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  webSearchRequests: number;
}

export function callCostMicros(model: AgentModel, usage: ModelUsage): number {
  const price = MODEL_PRICES[model];
  const long =
    price.longAbove !== undefined && usage.inputTokens > price.longAbove;
  const input = long ? (price.longInput ?? price.input) : price.input;
  const output = long ? (price.longOutput ?? price.output) : price.output;
  return Math.ceil(
    (usage.inputTokens * input + usage.outputTokens * output) / 1_000_000 +
      usage.webSearchRequests * WEB_SEARCH_MICROS,
  );
}

export const AgentTopicSchema = z.enum(['vehicle', 'area', 'coverage']);
export type AgentTopic = z.infer<typeof AgentTopicSchema>;
export const AGENT_TOPICS = AgentTopicSchema.options;

// The only lead data a model may see: the situation, never the person.
export const AgentLeadProjectionSchema = z
  .object({
    vehicle: z
      .object({
        modelYear: z.number().int(),
        make: z.string().min(1).max(60),
        model: z.string().min(1).max(80),
      })
      .strict()
      .nullable(),
    area: z
      .object({
        placeName: z.string().min(1).max(80),
        stateAbbreviation: z.string().min(2).max(3),
      })
      .strict()
      .nullable(),
    needs: z
      .object({
        needTimeline: NeedTimelineSchema.nullable(),
        coverageFocus: CoverageFocusSchema.nullable(),
        requestIntent: RequestIntentSchema.nullable(),
      })
      .strict(),
  })
  .strict();
export type AgentLeadProjection = z.infer<typeof AgentLeadProjectionSchema>;

// Vehicle and area come only from found evidence matching the lead; a ZIP
// with several places contributes no area.
export function agentProjectionFrom(input: {
  intake: IntakeSubmission;
  evidence: readonly EnrichmentEvidence[];
}): AgentLeadProjection {
  const vehicleEvidence = input.evidence.find(
    (record) =>
      record.source === 'nhtsa_vpic' &&
      record.outcome === 'found' &&
      record.subject.kind === 'vehicle' &&
      record.subject.make === input.intake.vehicleMake &&
      record.subject.modelYear === input.intake.vehicleYear &&
      record.subject.model === input.intake.vehicleModel,
  );
  const zipEvidence = input.evidence.find(
    (record) =>
      record.source === 'zippopotam_us' &&
      record.outcome === 'found' &&
      record.subject.kind === 'zip' &&
      record.subject.zipCode === input.intake.zipCode,
  );
  const vehicleClaim = vehicleEvidence?.claim;
  const zipClaim = zipEvidence?.claim;
  const place =
    zipClaim?.kind === 'zip_places' && zipClaim.places.length === 1
      ? zipClaim.places[0]
      : undefined;
  return AgentLeadProjectionSchema.parse({
    vehicle:
      vehicleClaim?.kind === 'vehicle_listing' &&
      vehicleClaim.listed &&
      vehicleClaim.modelName !== null &&
      vehicleEvidence?.subject.kind === 'vehicle' &&
      vehicleEvidence.subject.make !== null
        ? {
            modelYear: vehicleClaim.modelYear,
            make: vehicleEvidence.subject.make,
            model: vehicleClaim.modelName,
          }
        : null,
    area:
      place === undefined
        ? null
        : {
            placeName: place.placeName,
            stateAbbreviation: place.stateAbbreviation,
          },
    needs: {
      needTimeline: input.intake.needTimeline,
      coverageFocus: input.intake.coverageFocus,
      requestIntent: input.intake.requestIntent,
    },
  });
}

// --- Claims ------------------------------------------------------------------

export const ClaimIdSchema = z.string().regex(/^c(?:[1-9]|1[0-2])$/u);

export const CandidateClaimSchema = z
  .object({
    topic: AgentTopicSchema,
    text: z.string().min(1).max(400),
    url: z.string().max(2_048),
    title: z.string().max(300).nullable(),
    quote: z.string().max(1_000),
  })
  .strict();
export type CandidateClaim = z.infer<typeof CandidateClaimSchema>;

export const AgentClaimSchema = CandidateClaimSchema.extend({
  claimId: ClaimIdSchema,
}).strict();
export type AgentClaim = z.infer<typeof AgentClaimSchema>;

const STOPWORDS = new Set([
  'about',
  'also',
  'been',
  'from',
  'have',
  'into',
  'more',
  'most',
  'other',
  'some',
  'such',
  'than',
  'that',
  'their',
  'them',
  'they',
  'this',
  'were',
  'what',
  'when',
  'which',
  'will',
  'with',
  'your',
]);

const normalize = (value: string) =>
  value.toLocaleLowerCase('en-US').replace(/\s+/gu, ' ').trim();

// Digits with thousands separators or decimals, normalized: "2,500" -> "2500".
export function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d(?:[\d,]*\d)?(?:\.\d+)?/gu)].map((match) =>
    match[0].replaceAll(',', ''),
  );
}

function contentWords(text: string): string[] {
  return [
    ...new Set(
      normalize(text)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length >= 4 && !/^\d+$/u.test(word))
        .filter((word) => !STOPWORDS.has(word)),
    ),
  ];
}

export type ClaimRejection =
  | 'url_not_https'
  | 'quote_missing'
  | 'number_unsupported'
  | 'no_content_words'
  | 'words_unsupported';

// Deterministic support check: the quote is what the search returned for
// the URL; the claim keeps only what that quote can carry.
export function checkClaim(
  claim: Pick<CandidateClaim, 'text' | 'url' | 'quote'>,
): ClaimRejection | null {
  let url: URL;
  try {
    url = new URL(claim.url);
  } catch {
    return 'url_not_https';
  }
  if (url.protocol !== 'https:') return 'url_not_https';
  const quote = normalize(claim.quote);
  if (quote.length === 0) return 'quote_missing';
  const quoteNumbers = new Set(numbersIn(quote));
  if (numbersIn(claim.text).some((number) => !quoteNumbers.has(number))) {
    return 'number_unsupported';
  }
  const words = contentWords(claim.text);
  if (words.length === 0) return 'no_content_words';
  const supported = words.filter((word) => quote.includes(word)).length;
  return supported * 2 >= words.length ? null : 'words_unsupported';
}

// Keeps at most four supported claims per topic, in arrival order, and
// numbers them c1..c12.
export function keepClaims(candidates: readonly CandidateClaim[]): {
  claims: AgentClaim[];
  rejected: number;
} {
  const claims: AgentClaim[] = [];
  let rejected = 0;
  const perTopic = new Map<AgentTopic, number>();
  for (const candidate of candidates) {
    const count = perTopic.get(candidate.topic) ?? 0;
    if (
      count >= AGENT_LIMITS.maxClaimsPerTopic ||
      checkClaim(candidate) !== null ||
      claims.some((claim) => claim.text === candidate.text)
    ) {
      rejected += 1;
      continue;
    }
    perTopic.set(candidate.topic, count + 1);
    claims.push({ ...candidate, claimId: `c${claims.length + 1}` });
  }
  return { claims, rejected };
}

// --- Draft paragraph rules (agent-rules-v1) ----------------------------------

export type ParagraphFailure =
  | 'length'
  | 'sentence_count'
  | 'no_citation'
  | 'unknown_claim'
  | 'number_unsupported'
  | 'forbidden_characters'
  | 'decision_language';

export function checkParagraph(
  paragraph: string,
  claimIds: readonly string[],
  claims: readonly AgentClaim[],
  // Numbers the lead's own situation supplies (the vehicle's model year).
  allowedNumbers: readonly string[] = [],
): { failures: ParagraphFailure[]; decisionTerms: string[] } {
  const failures: ParagraphFailure[] = [];
  const trimmed = paragraph.trim();
  if (
    trimmed.length === 0 ||
    trimmed !== paragraph ||
    paragraph.length > AGENT_LIMITS.paragraphMaxChars
  ) {
    failures.push('length');
  }
  const sentences = trimmed.match(/[.!?](?=\s|$)/gu)?.length ?? 0;
  if (sentences < 2 || sentences > 4) failures.push('sentence_count');
  if (claimIds.length === 0) failures.push('no_citation');
  const cited = claims.filter((claim) => claimIds.includes(claim.claimId));
  if (cited.length !== new Set(claimIds).size) failures.push('unknown_claim');
  const supported = new Set([
    ...allowedNumbers,
    ...cited.flatMap((claim) => numbersIn(claim.quote)),
  ]);
  if (numbersIn(paragraph).some((number) => !supported.has(number))) {
    failures.push('number_unsupported');
  }
  if (/https?:|www\.|@|[<>\r\n]/iu.test(paragraph)) {
    failures.push('forbidden_characters');
  }
  const decisionTerms = findDecisionLanguage(paragraph);
  if (decisionTerms.length > 0) failures.push('decision_language');
  return { failures, decisionTerms };
}

// --- Stored brief (agent-brief-v1) ---------------------------------------------

export const AgentRoleSchema = z.enum([
  'lead_plan',
  'worker',
  'lead_merge',
  'writer',
  'critic',
]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentFallbackReasonSchema = z.enum([
  'no_research_subject',
  'budget_exceeded',
  'model_error',
  'no_verified_claims',
  'rule_check_failed',
  'critic_unresolved',
]);
export type AgentFallbackReason = z.infer<typeof AgentFallbackReasonSchema>;

export const AgentCallSchema = z
  .object({
    role: AgentRoleSchema,
    topic: AgentTopicSchema.nullable(),
    attempt: z.number().int().min(1).max(3),
    model: z.enum([AGENT_MODELS.lead, AGENT_MODELS.worker]),
    outcome: z.enum(['ok', 'error', 'not_made']),
    errorCode: z
      .string()
      .regex(/^[a-z_]{1,60}$/u)
      .nullable(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    webSearchRequests: z.number().int().nonnegative(),
    reservedMicros: z.number().int().nonnegative(),
    costMicros: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();
export type AgentCall = z.infer<typeof AgentCallSchema>;

export const BriefPointSchema = z
  .object({
    text: z.string().min(1).max(300),
    claimIds: z.array(ClaimIdSchema).min(1).max(4),
  })
  .strict();
export type BriefPoint = z.infer<typeof BriefPointSchema>;

const QuestionsSchema = z
  .array(z.string().min(5).max(200))
  .max(AGENT_LIMITS.maxQuestionsPerTopic);

export const AgentBriefRecordSchema = z
  .object({
    schemaVersion: z.literal(AGENT_VERSIONS.brief),
    briefId: IdentifierSchema,
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    createdAt: UtcTimestampSchema,
    teamVersion: z.literal(AGENT_VERSIONS.team),
    rulesVersion: z.literal(AGENT_VERSIONS.rules),
    promptsSha256: Sha256Schema,
    projection: AgentLeadProjectionSchema,
    status: z.enum(['drafted', 'fallback']),
    fallbackReason: AgentFallbackReasonSchema.nullable(),
    questions: z
      .object({
        vehicle: QuestionsSchema,
        area: QuestionsSchema,
        coverage: QuestionsSchema,
      })
      .strict(),
    candidateClaims: z.number().int().nonnegative(),
    rejectedClaims: z.number().int().nonnegative(),
    claims: z.array(AgentClaimSchema).max(12),
    points: z.array(BriefPointSchema).max(AGENT_LIMITS.maxPoints),
    paragraph: z.string().max(AGENT_LIMITS.paragraphMaxChars).nullable(),
    paragraphClaimIds: z.array(ClaimIdSchema).max(12),
    attempts: z
      .number()
      .int()
      .min(0)
      .max(AGENT_LIMITS.maxRewrites + 1),
    criticNotes: z.array(z.string().min(1).max(300)).max(10),
    calls: z.array(AgentCallSchema).max(20),
    totalCostMicros: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, context) => {
    const drafted = value.status === 'drafted';
    if (drafted !== (value.paragraph !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['paragraph'],
        message: 'only a drafted brief carries a paragraph',
      });
    }
    if (drafted !== (value.fallbackReason === null)) {
      context.addIssue({
        code: 'custom',
        path: ['fallbackReason'],
        message: 'a fallback names its reason; a drafted brief does not',
      });
    }
    const total = value.calls.reduce((sum, call) => sum + call.costMicros, 0);
    if (total !== value.totalCostMicros) {
      context.addIssue({
        code: 'custom',
        path: ['totalCostMicros'],
        message: 'total cost must equal the sum of call costs',
      });
    }
  });
export type AgentBriefRecord = z.infer<typeof AgentBriefRecordSchema>;

// Re-runs the deterministic checks on a stored brief: every claim must still
// pass the claim check and a drafted paragraph must pass the rule checker.
export function storedBriefFailures(brief: AgentBriefRecord): string[] {
  const failures = brief.claims
    .filter((claim) => checkClaim(claim) !== null)
    .map((claim) => `claim_${claim.claimId}`);
  if (brief.paragraph !== null) {
    failures.push(
      ...checkParagraph(
        brief.paragraph,
        brief.paragraphClaimIds,
        brief.claims,
        projectionNumbers(brief.projection),
      ).failures,
    );
  }
  return failures;
}

export const projectionNumbers = (projection: AgentLeadProjection) =>
  projection.vehicle === null ? [] : [String(projection.vehicle.modelYear)];

// The draft slot value: the paragraph as its own block of the email body.
export const agentParagraphSlotValue = (paragraph: string) =>
  `\n\n${paragraph}`;
