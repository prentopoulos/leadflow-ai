import {
  CONTRACT_VERSIONS,
  QualificationInterpretationSchema,
  QualificationResultSchema,
  type QualificationField,
  type QualificationResult,
} from './phase1.js';

const timelinePoints = {
  within_30_days: 40,
  days_31_to_90: 30,
  over_90_days: 20,
  researching: 10,
  not_sure: 0,
} as const;

export function priorityForTotal(total: number) {
  if (!Number.isInteger(total) || total < 0 || total > 100) {
    throw new Error(
      'marketing-readiness total must be an integer from 0 to 100',
    );
  }
  if (total >= 80) return 'high' as const;
  if (total >= 50) return 'standard' as const;
  return 'nurture' as const;
}

export interface QualificationResultContext {
  resultId: string;
  runId: string;
  leadId: string;
  generatedAt: string;
}

function heldResult(
  context: QualificationResultContext,
  message: string,
): QualificationResult {
  return QualificationResultSchema.parse({
    schemaVersion: 'qualification-result-v1',
    rubricVersion: CONTRACT_VERSIONS.rubric,
    interpreterVersion: 'deterministic-interpreter-v1',
    ...context,
    classification: 'marketing_readiness',
    criteria: null,
    total: null,
    priority: null,
    missingInformation: [],
    integrityHold: {
      code: 'invalid_qualification_evidence',
      message,
    },
    meaning: 'marketing readiness only; not an insurance decision',
  });
}

export function scoreQualification(
  candidate: unknown,
  context: QualificationResultContext,
): QualificationResult {
  const parsed = QualificationInterpretationSchema.safeParse(candidate);
  if (!parsed.success) {
    return heldResult(
      context,
      'Qualification interpretation failed validation.',
    );
  }
  const interpretation = parsed.data;
  if (interpretation.leadId !== context.leadId) {
    return heldResult(
      context,
      'Qualification interpretation lead identity mismatched.',
    );
  }

  const complete = new Set<QualificationField>(interpretation.completeFields);
  const missing = new Set<QualificationField>(interpretation.missingFields);
  const evidenceMismatch =
    (interpretation.needTimeline !== null) !== complete.has('needTimeline') ||
    (interpretation.requestIntent !== null) !== complete.has('requestIntent') ||
    (interpretation.coverageFocus !== null) !== complete.has('coverageFocus') ||
    interpretation.hasRequestDetails !== complete.has('requestDetails');
  if (evidenceMismatch) {
    return heldResult(
      context,
      'Qualification values did not match their declared field evidence.',
    );
  }

  const timeline = interpretation.needTimeline;
  const needTimelineComponents = [
    {
      component: 'declared_need_timeline',
      points: timeline === null ? 0 : timelinePoints[timeline],
      evidenceFields:
        timeline !== null && timelinePoints[timeline] > 0
          ? (['needTimeline'] as QualificationField[])
          : [],
    },
  ];

  const clarityComponents = [
    {
      component: 'declared_request_intent',
      points: interpretation.requestIntent === null ? 0 : 15,
      evidenceFields:
        interpretation.requestIntent === null
          ? []
          : (['requestIntent'] as QualificationField[]),
    },
    {
      component: 'declared_coverage_focus',
      points: interpretation.coverageFocus === null ? 0 : 10,
      evidenceFields:
        interpretation.coverageFocus === null
          ? []
          : (['coverageFocus'] as QualificationField[]),
    },
    {
      component: 'bounded_request_details',
      points: interpretation.hasRequestDetails ? 5 : 0,
      evidenceFields: interpretation.hasRequestDetails
        ? (['requestDetails'] as QualificationField[])
        : [],
    },
  ];

  const completenessComponents = [
    {
      component: 'name_pair',
      points: complete.has('givenName') && complete.has('familyName') ? 5 : 0,
      evidenceFields:
        complete.has('givenName') && complete.has('familyName')
          ? (['givenName', 'familyName'] as QualificationField[])
          : [],
    },
    ...(
      [
        ['test_email', 'email', 5],
        ['vehicle_year', 'vehicleYear', 4],
        ['vehicle_make', 'vehicleMake', 4],
        ['vehicle_model', 'vehicleModel', 4],
        ['zip_code', 'zipCode', 4],
        ['coverage_focus', 'coverageFocus', 4],
      ] as const
    ).map(([component, field, points]) => ({
      component,
      points: complete.has(field) ? points : 0,
      evidenceFields: complete.has(field)
        ? ([field] as QualificationField[])
        : [],
    })),
  ];

  const sum = (components: Array<{ points: number }>) =>
    components.reduce((total, component) => total + component.points, 0);
  const criteria = {
    needTimeline: {
      points: sum(needTimelineComponents),
      maximum: 40,
      components: needTimelineComponents,
    },
    requestClarity: {
      points: sum(clarityComponents),
      maximum: 30,
      components: clarityComponents,
    },
    completeness: {
      points: sum(completenessComponents),
      maximum: 30,
      components: completenessComponents,
    },
  } as const;
  const total =
    criteria.needTimeline.points +
    criteria.requestClarity.points +
    criteria.completeness.points;

  return QualificationResultSchema.parse({
    schemaVersion: 'qualification-result-v1',
    rubricVersion: CONTRACT_VERSIONS.rubric,
    interpreterVersion: interpretation.interpreterVersion,
    ...context,
    classification: 'marketing_readiness',
    criteria,
    total,
    priority: priorityForTotal(total),
    missingInformation: [...missing].sort(),
    integrityHold: null,
    meaning: 'marketing readiness only; not an insurance decision',
  });
}
