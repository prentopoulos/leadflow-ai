import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  GoogleIapKeySource,
  IapAssertionVerifier,
  hostedOperatorPrincipal,
  type IapKeySource,
} from './iap.js';

// Synthetic keys, audience and subjects only; no Google key or account value.
const AUDIENCE =
  '/projects/123456789012/locations/northamerica-northeast2/services/leadflow-ai-demo';
const OWNER = 'accounts.google.com:100000000000000000001';
const STRANGER = 'accounts.google.com:100000000000000000002';

function keyPair() {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' });
}

const trusted = keyPair();
const untrusted = keyPair();

function pem(key: KeyObject): string {
  return key.export({ type: 'spki', format: 'pem' }).toString();
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

interface TokenOptions {
  kid?: string;
  alg?: string;
  signer?: KeyObject;
  claims?: Record<string, unknown>;
}

function token(options: TokenOptions = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({
    alg: options.alg ?? 'ES256',
    kid: options.kid ?? 'synthetic-key',
    typ: 'JWT',
  });
  const payload = encode({
    iss: 'https://cloud.google.com/iap',
    aud: AUDIENCE,
    sub: OWNER,
    email: 'owner@example.com',
    iat: now,
    exp: now + 600,
    ...options.claims,
  });
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), {
    key: options.signer ?? trusted.privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

class StaticKeys implements IapKeySource {
  calls: { refresh?: boolean }[] = [];
  constructor(private readonly values: Record<string, string>) {}
  async keys(options: { refresh?: boolean } = {}) {
    this.calls.push(options);
    return this.values;
  }
}

function verifier(
  keys = new StaticKeys({ 'synthetic-key': pem(trusted.publicKey) }),
) {
  return new IapAssertionVerifier({
    audience: AUDIENCE,
    allowedSubjects: [OWNER],
    keys,
  });
}

describe('IAP assertion verification', () => {
  it('accepts a current signed assertion for an allowlisted subject', async () => {
    const result = await verifier().verify(token());
    expect(result).toEqual({
      status: 'allowed',
      principal: hostedOperatorPrincipal(OWNER),
    });
    // The private identifier carries neither the subject nor the email.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(OWNER);
    expect(serialized).not.toContain('100000000000000000001');
    expect(serialized).not.toContain('owner@example.com');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['array header', [token()]],
    ['two segments', 'a.b'],
    ['oversized', `${'a'.repeat(5000)}.b.c`],
    ['garbage', 'not.a.jwt'],
  ])('rejects a %s assertion before key lookup', async (_label, value) => {
    const keys = new StaticKeys({ 'synthetic-key': pem(trusted.publicKey) });
    expect(await verifier(keys).verify(value)).toEqual({
      status: 'unauthenticated',
    });
    expect(keys.calls).toEqual([]);
  });

  it.each([
    ['forged signature', { signer: untrusted.privateKey }],
    ['wrong algorithm', { alg: 'RS256' }],
    ['unknown key ID', { kid: 'other-key' }],
    ['wrong issuer', { claims: { iss: 'https://accounts.google.com' } }],
    [
      'wrong audience',
      {
        claims: {
          aud: '/projects/123456789012/locations/northamerica-northeast2/services/other',
        },
      },
    ],
    [
      'expired',
      {
        claims: {
          iat: Math.floor(Date.now() / 1000) - 7200,
          exp: Math.floor(Date.now() / 1000) - 3600,
        },
      },
    ],
    [
      'overlong lifetime',
      {
        claims: {
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 7200,
        },
      },
    ],
    ['missing subject', { claims: { sub: undefined } }],
    ['email-shaped subject', { claims: { sub: 'owner@example.com' } }],
  ])('fails closed for a %s', async (_label, options) => {
    expect(await verifier().verify(token(options))).toEqual({
      status: 'unauthenticated',
    });
  });

  it('forbids a valid assertion for a subject outside the allowlist', async () => {
    expect(
      await verifier().verify(token({ claims: { sub: STRANGER } })),
    ).toEqual({ status: 'forbidden' });
  });

  it('refreshes keys once when an unknown key ID appears', async () => {
    const keys = new StaticKeys({ 'synthetic-key': pem(trusted.publicKey) });
    await verifier(keys).verify(token({ kid: 'rotated-key' }));
    expect(keys.calls).toEqual([{}, { refresh: true }]);
  });

  it('treats a key-service failure as unauthenticated', async () => {
    const failing: IapKeySource = {
      keys: async () => {
        throw new Error('network unavailable');
      },
    };
    expect(await verifier(failing as StaticKeys).verify(token())).toEqual({
      status: 'unauthenticated',
    });
  });
});

describe('IAP key cache', () => {
  it('caches keys and rate-limits forced refreshes', async () => {
    let now = 0;
    let fetches = 0;
    const source = new GoogleIapKeySource(
      {
        getIapPublicKeys: (async () => {
          fetches += 1;
          return { pubkeys: { 'synthetic-key': 'pem' } };
        }) as never,
      },
      () => now,
    );
    await source.keys();
    await source.keys({ refresh: true });
    expect(fetches).toBe(1);
    now = 61_000;
    await source.keys({ refresh: true });
    expect(fetches).toBe(2);
    now = 61_000 + 3_600_000;
    await source.keys();
    expect(fetches).toBe(3);
  });
});
