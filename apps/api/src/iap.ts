import { createHash } from 'node:crypto';
import {
  HOSTED_OPERATOR_LABEL,
  IAP_ISSUER,
  IapSubjectSchema,
  type OperatorPrincipal,
} from '@leadflow-ai/domain';
import { OAuth2Client } from 'google-auth-library';

// IAP's signed assertions live about ten minutes; anything claiming a longer
// lifetime is refused even when correctly signed.
const MAX_ASSERTION_LIFETIME_SECONDS = 900;
const MAX_ASSERTION_LENGTH = 4096;
const KEY_CACHE_MS = 60 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;

export type IapPublicKeys = Record<string, string>;

export interface IapKeySource {
  keys(options?: { refresh?: boolean }): Promise<IapPublicKeys>;
}

// Google rotates IAP keys; cache them and refresh at most once a minute when
// an unknown key ID appears, so forged kids cannot drive key fetches.
export class GoogleIapKeySource implements IapKeySource {
  private cached: { keys: IapPublicKeys; fetchedAt: number } | null = null;

  constructor(
    private readonly client: Pick<
      OAuth2Client,
      'getIapPublicKeys'
    > = new OAuth2Client(),
    private readonly now: () => number = Date.now,
  ) {}

  async keys(options: { refresh?: boolean } = {}): Promise<IapPublicKeys> {
    const age =
      this.cached === null ? Infinity : this.now() - this.cached.fetchedAt;
    const refreshAllowed = age >= MIN_REFRESH_INTERVAL_MS;
    if (
      this.cached === null ||
      age >= KEY_CACHE_MS ||
      (options.refresh === true && refreshAllowed)
    ) {
      const response = await this.client.getIapPublicKeys();
      this.cached = { keys: { ...response.pubkeys }, fetchedAt: this.now() };
    }
    return this.cached.keys;
  }
}

export type IapVerification =
  | { status: 'allowed'; principal: OperatorPrincipal }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' };

export interface IapVerifierOptions {
  audience: string;
  allowedSubjects: readonly string[];
  keys: IapKeySource;
  client?: Pick<OAuth2Client, 'verifySignedJwtWithCertsAsync'>;
}

export function hostedOperatorPrincipal(subject: string): OperatorPrincipal {
  const digest = createHash('sha256').update(subject, 'utf8').digest('hex');
  return {
    id: `owner-${digest.slice(0, 24)}`,
    label: HOSTED_OPERATOR_LABEL,
    authenticated: true,
  };
}

function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function envelopeOf(token: string): { kid: string } | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  const envelope = decodeSegment(segments[0] ?? '');
  if (typeof envelope !== 'object' || envelope === null) return null;
  const { alg, kid } = envelope as { alg?: unknown; kid?: unknown };
  // IAP signs with ES256 only; refuse any other algorithm before the library
  // chooses a verification path.
  if (alg !== 'ES256' || typeof kid !== 'string' || kid.length > 128) {
    return null;
  }
  return { kid };
}

// Validates the signed `x-goog-iap-jwt-assertion` (signature, issuer,
// audience, timestamps) and then the stable subject against the private
// allowlist. Email and display headers are never consulted. Failures return a
// fixed outcome; library messages, which embed the token, are discarded.
export class IapAssertionVerifier {
  private readonly client: Pick<OAuth2Client, 'verifySignedJwtWithCertsAsync'>;
  private readonly allowed: ReadonlySet<string>;

  constructor(private readonly options: IapVerifierOptions) {
    this.client = options.client ?? new OAuth2Client();
    this.allowed = new Set(options.allowedSubjects);
  }

  async verify(assertion: unknown): Promise<IapVerification> {
    if (
      typeof assertion !== 'string' ||
      assertion.length === 0 ||
      assertion.length > MAX_ASSERTION_LENGTH
    ) {
      return { status: 'unauthenticated' };
    }
    const envelope = envelopeOf(assertion);
    if (envelope === null) return { status: 'unauthenticated' };

    let keys: IapPublicKeys;
    try {
      keys = await this.options.keys.keys();
      if (!Object.hasOwn(keys, envelope.kid)) {
        keys = await this.options.keys.keys({ refresh: true });
      }
    } catch {
      return { status: 'unauthenticated' };
    }
    if (!Object.hasOwn(keys, envelope.kid)) {
      return { status: 'unauthenticated' };
    }

    let subject: unknown;
    try {
      const ticket = await this.client.verifySignedJwtWithCertsAsync(
        assertion,
        keys,
        this.options.audience,
        [IAP_ISSUER],
        MAX_ASSERTION_LIFETIME_SECONDS,
      );
      subject = ticket.getPayload()?.sub;
    } catch {
      return { status: 'unauthenticated' };
    }
    const parsed = IapSubjectSchema.safeParse(subject);
    if (!parsed.success) return { status: 'unauthenticated' };
    if (!this.allowed.has(parsed.data)) return { status: 'forbidden' };
    return {
      status: 'allowed',
      principal: hostedOperatorPrincipal(parsed.data),
    };
  }
}
