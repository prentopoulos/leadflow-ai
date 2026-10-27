import { describe, expect, it } from 'vitest';
import { channelFor } from './acquisition.js';
import { IntakeSubmissionSchema } from './phase1.js';
import {
  PLANNED_TRAFFIC_LEADS,
  SIMULATED_CAMPAIGNS,
  runTrafficPlan,
  trafficIdempotencyKey,
  trafficPlan,
  trafficRefusal,
} from './traffic.js';

describe('traffic-plan-v1', () => {
  it('plans the full campaign mix with valid fictional intakes', () => {
    const plan = trafficPlan();
    expect(plan).toHaveLength(PLANNED_TRAFFIC_LEADS);
    expect(
      SIMULATED_CAMPAIGNS.reduce(
        (total, campaign) => total + campaign.leads,
        0,
      ),
    ).toBe(PLANNED_TRAFFIC_LEADS);
    for (const campaign of SIMULATED_CAMPAIGNS) {
      expect(
        plan.filter(
          (entry) => entry.intake.attribution?.campaign === campaign.campaign,
        ),
      ).toHaveLength(campaign.leads);
    }
    for (const entry of plan) {
      expect(IntakeSubmissionSchema.parse(entry.intake)).toEqual(entry.intake);
    }
  });

  it('marks only paid leads with synthetic click IDs', () => {
    for (const { intake } of trafficPlan()) {
      const channel = channelFor(intake.attribution);
      const paid = channel === 'paid_search' || channel === 'paid_social';
      expect(intake.attribution?.clickId != null).toBe(paid);
    }
  });

  it('keys leads per bundle and refuses non-recorded enrichment', () => {
    expect(trafficIdempotencyKey('0123456789abcdef', 59)).toBe(
      'traffic-v1-01234567-60',
    );
    expect(trafficRefusal('recorded')).toBeNull();
    expect(trafficRefusal('live')).toMatch(/recorded enrichment/u);
  });
});

describe('runTrafficPlan', () => {
  it('rejects counts and intervals outside the plan bounds', async () => {
    const options = {
      submit: async () => 'created' as const,
      sleep: async () => undefined,
    };
    await expect(
      runTrafficPlan({ ...options, count: 61, intervalMs: 0 }),
    ).rejects.toBeInstanceOf(RangeError);
    await expect(
      runTrafficPlan({ ...options, count: 1, intervalMs: 61_000 }),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it('propagates a rejected submission without continuing', async () => {
    const submitted: number[] = [];
    await expect(
      runTrafficPlan({
        count: 3,
        intervalMs: 0,
        submit: async (entry) => {
          submitted.push(entry.index);
          throw new Error('rejected');
        },
        sleep: async () => undefined,
      }),
    ).rejects.toThrow('rejected');
    expect(submitted).toEqual([0]);
  });
});
