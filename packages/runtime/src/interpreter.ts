import {
  LeadDocumentSchema,
  PHASE_ONE_VERSIONS,
  QUALIFICATION_FIELDS,
  QualificationInterpretationSchema,
  QualificationProjectionSchema,
  type LeadDocument,
  type QualificationField,
  type QualificationInterpretation,
  type QualificationProjection,
} from '@leadflow-ai/domain';

export interface QualificationInterpreter {
  readonly version: 'deterministic-interpreter-v1';
  interpret(
    projection: QualificationProjection,
  ): Promise<QualificationInterpretation>;
}

export function qualificationProjectionFromLead(
  candidate: unknown,
): QualificationProjection {
  const lead: LeadDocument = LeadDocumentSchema.parse(candidate);
  return QualificationProjectionSchema.parse({
    schemaVersion: PHASE_ONE_VERSIONS.qualificationProjection,
    leadId: lead.leadId,
    givenName: lead.intake.givenName,
    familyName: lead.intake.familyName,
    email: lead.intake.email,
    zipCode: lead.intake.zipCode,
    vehicleYear: lead.intake.vehicleYear,
    vehicleMake: lead.intake.vehicleMake,
    vehicleModel: lead.intake.vehicleModel,
    coverageFocus: lead.intake.coverageFocus,
    requestIntent: lead.intake.requestIntent,
    needTimeline: lead.intake.needTimeline,
    requestDetails: lead.intake.requestDetails,
  });
}

export class DeterministicQualificationInterpreter implements QualificationInterpreter {
  readonly version = 'deterministic-interpreter-v1' as const;

  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async interpret(
    candidate: QualificationProjection,
  ): Promise<QualificationInterpretation> {
    const projection = QualificationProjectionSchema.parse(candidate);
    const hasRequestDetails =
      projection.requestDetails !== null &&
      projection.requestDetails.trim().length > 0;
    const present: Record<QualificationField, boolean> = {
      givenName: projection.givenName.length > 0,
      familyName: projection.familyName.length > 0,
      email: projection.email.length > 0,
      zipCode: projection.zipCode.length > 0,
      vehicleYear: projection.vehicleYear !== null,
      vehicleMake: projection.vehicleMake !== null,
      vehicleModel: projection.vehicleModel !== null,
      coverageFocus: projection.coverageFocus !== null,
      requestIntent: projection.requestIntent !== null,
      needTimeline: projection.needTimeline !== null,
      requestDetails: hasRequestDetails,
    };
    const completeFields = QUALIFICATION_FIELDS.filter(
      (field) => present[field],
    );
    const missingFields = QUALIFICATION_FIELDS.filter(
      (field) => !present[field],
    );
    return QualificationInterpretationSchema.parse({
      schemaVersion: PHASE_ONE_VERSIONS.interpretation,
      interpreterVersion: this.version,
      leadId: projection.leadId,
      interpretedAt: this.now(),
      needTimeline: projection.needTimeline,
      requestIntent: projection.requestIntent,
      coverageFocus: projection.coverageFocus,
      hasRequestDetails,
      completeFields,
      missingFields,
      evidenceSource: 'normalized_intake',
    });
  }
}
