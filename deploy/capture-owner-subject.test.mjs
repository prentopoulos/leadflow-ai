import { describe, expect, it } from 'vitest';
import { ownerSubjectFromIdentityToken } from './capture-owner-subject.mjs';

function token(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

describe('owner subject bootstrap', () => {
  const payload = {
    iss: 'https://accounts.google.com',
    email: 'owner@example.com',
    email_verified: true,
    sub: '123456789012345678901',
    exp: 2_000,
  };

  it('extracts only the stable subject from the current owner token', () => {
    expect(
      ownerSubjectFromIdentityToken(token(payload), 'owner@example.com', 1_000),
    ).toBe(['accounts.google.com', payload.sub].join(':'));
  });

  it.each([
    ['wrong owner', { email: 'other@example.com' }],
    ['unverified email', { email_verified: false }],
    ['wrong issuer', { iss: 'https://issuer.example' }],
    ['expired', { exp: 999 }],
    ['malformed subject', { sub: 'owner@example.com' }],
  ])('refuses a %s token', (_label, change) => {
    expect(() =>
      ownerSubjectFromIdentityToken(
        token({ ...payload, ...change }),
        'owner@example.com',
        1_000,
      ),
    ).toThrow(/not the current required owner/u);
  });
});
