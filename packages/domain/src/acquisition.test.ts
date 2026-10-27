import { describe, expect, it } from 'vitest';
import {
  AttributionSchema,
  CHANNEL_LABELS,
  ChannelSchema,
  channelFor,
} from './acquisition.js';
import { IntakeSubmissionSchema, currentConsentRecord } from './phase1.js';

const paid = {
  source: 'google',
  medium: 'cpc',
  campaign: 'sim-search-auto-insurance-q4',
  clickId: 'sim-0123456789abcdef0123',
  clickIdClass: 'synthetic',
};

const intake = {
  schemaVersion: 'intake-v3',
  identityClass: 'fictional',
  givenName: 'Avery',
  familyName: 'Example',
  email: 'avery@example.org',
  zipCode: '22150',
  emailContactConsent: true,
  consentRecord: currentConsentRecord(),
};

const channel = (source: string, medium: string) =>
  channelFor(AttributionSchema.parse({ source, medium, campaign: 'sim-x' }));

describe('channel-rules-v1', () => {
  it('classifies the simulated campaigns', () => {
    expect(channel('google', 'cpc')).toBe('paid_search');
    expect(channel('facebook', 'paid_social')).toBe('paid_social');
    expect(channel('newsletter', 'email')).toBe('email');
    expect(channel('milspouse-blog', 'affiliate')).toBe('affiliates');
    expect(channel('google', 'organic')).toBe('organic_search');
    expect(channel('(direct)', '(none)')).toBe('direct');
  });

  it('keeps Unassigned distinct from Unattributed', () => {
    expect(channel('google', 'display')).toBe('unassigned');
    expect(channel('facebook', 'referral')).toBe('unassigned');
    expect(channelFor(null)).toBe('unattributed');
  });

  it('labels every channel', () => {
    for (const value of ChannelSchema.options) {
      expect(CHANNEL_LABELS[value].length).toBeGreaterThan(0);
    }
  });
});

describe('synthetic attribution', () => {
  it('accepts a synthetic click ID and an unclicked attribution', () => {
    expect(AttributionSchema.parse(paid).clickId).toBe(paid.clickId);
    expect(
      AttributionSchema.parse({
        source: '(direct)',
        medium: '(none)',
        campaign: '(direct)',
      }),
    ).toMatchObject({ clickId: null, clickIdClass: null });
  });

  it('refuses real-looking or unmarked click IDs', () => {
    for (const clickId of [
      'Cj0KCQjw-real-looking-gclid',
      'IwAR0abcdefghijklmnop',
      'sim-0123456789ABCDEF0123',
    ]) {
      expect(AttributionSchema.safeParse({ ...paid, clickId }).success).toBe(
        false,
      );
    }
    expect(
      AttributionSchema.safeParse({ ...paid, clickIdClass: null }).success,
    ).toBe(false);
  });

  it('refuses a client channel and non-slug values', () => {
    expect(
      AttributionSchema.safeParse({ ...paid, channel: 'paid_search' }).success,
    ).toBe(false);
    expect(
      AttributionSchema.safeParse({ ...paid, source: 'Google' }).success,
    ).toBe(false);
  });

  it('defaults intake attribution to null and rejects intake-v2', () => {
    expect(IntakeSubmissionSchema.parse(intake).attribution).toBeNull();
    expect(
      IntakeSubmissionSchema.parse({ ...intake, attribution: paid })
        .attribution,
    ).toEqual(paid);
    expect(
      IntakeSubmissionSchema.safeParse({
        ...intake,
        schemaVersion: 'intake-v2',
      }).success,
    ).toBe(false);
  });
});
