import "server-only";
import { createHash, randomBytes } from "crypto";
import { SignJWT, decodeJwt, jwtVerify } from "jose";
import { cookies } from "next/headers";

/* "Continue with Google / Microsoft" (OpenID Connect, authorization code
   flow with PKCE). Separate from lib/google-oauth.ts, which connects Gmail
   for sending. A provider only shows once its keys are set:

     GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
     MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET

   Each provider's console needs this redirect address:
     <APP_BASE_URL>/api/auth/oauth/<google|microsoft>/callback */

export type OAuthProvider = "google" | "microsoft";

type ProviderConfig = {
  label: string;
  authUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  extraParams?: Record<string, string>;
};

const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    label: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    extraParams: { prompt: "select_account" },
  },
  microsoft: {
    label: "Microsoft",
    // "common": work, school and personal Microsoft accounts.
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    extraParams: { prompt: "select_account" },
  },
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "microsoft";
}

export function providerLabel(provider: OAuthProvider) {
  return PROVIDERS[provider].label;
}

/** Providers whose keys are set, in the order the buttons show. */
export function enabledProviders(): OAuthProvider[] {
  return (Object.keys(PROVIDERS) as OAuthProvider[]).filter(
    (p) => process.env[PROVIDERS[p].clientIdEnv] && process.env[PROVIDERS[p].clientSecretEnv]
  );
}

function redirectUri(provider: OAuthProvider) {
  const base = process.env.APP_BASE_URL;
  if (!base) throw new Error("APP_BASE_URL environment variable is not set");
  return `${base}/api/auth/oauth/${provider}/callback`;
}

/** What the browser keeps (in a signed cookie) between leaving and coming back. */
export type OAuthRequest = { provider: OAuthProvider; state: string; verifier: string; nonce: string; mode: "signin" | "link"; remember: boolean };

export function newOAuthRequest(provider: OAuthProvider, mode: OAuthRequest["mode"], remember: boolean): OAuthRequest {
  const token = () => randomBytes(32).toString("base64url");
  return { provider, state: token(), verifier: token(), nonce: token(), mode, remember };
}

export function authorizationUrl(req: OAuthRequest): string {
  const config = PROVIDERS[req.provider];
  const params = new URLSearchParams({
    client_id: process.env[config.clientIdEnv] ?? "",
    redirect_uri: redirectUri(req.provider),
    response_type: "code",
    scope: "openid email profile",
    state: req.state,
    nonce: req.nonce,
    code_challenge: createHash("sha256").update(req.verifier).digest("base64url"),
    code_challenge_method: "S256",
    ...config.extraParams,
  });
  return `${config.authUrl}?${params.toString()}`;
}

export type OAuthIdentity = {
  provider: OAuthProvider;
  /** The provider's stable id for this person. */
  subject: string;
  email: string;
  /** Only Google says so reliably; Microsoft emails are never trusted alone. */
  emailVerified: boolean;
};

/**
 * Swaps the code for tokens and reads who signed in. The ID token comes
 * straight from the provider over TLS in exchange for our client secret, so
 * its claims are trusted without checking its signature (OpenID Connect
 * Core 3.1.3.7); audience, nonce and expiry are still checked.
 */
export async function exchangeCode(req: OAuthRequest, code: string): Promise<OAuthIdentity> {
  const config = PROVIDERS[req.provider];
  const clientId = process.env[config.clientIdEnv] ?? "";
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(req.provider),
      client_id: clientId,
      client_secret: process.env[config.clientSecretEnv] ?? "",
      code_verifier: req.verifier,
    }),
  });
  if (!res.ok) throw new Error(`${config.label} sign in failed: ${res.status}`);
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error(`${config.label} sent no ID token`);

  const claims = decodeJwt(body.id_token);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(clientId)) throw new Error("ID token is for another app");
  if (claims.nonce !== req.nonce) throw new Error("ID token nonce does not match");
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("ID token expired");
  if (typeof claims.sub !== "string") throw new Error("ID token has no subject");

  const email = String(claims.email ?? claims.preferred_username ?? "").trim().toLowerCase();
  return {
    provider: req.provider,
    // Microsoft's `sub` differs per app; `oid` + `tid` is the person.
    subject: req.provider === "microsoft" && claims.oid && claims.tid ? `${claims.tid}:${claims.oid}` : claims.sub,
    email,
    emailVerified: req.provider === "google" && claims.email_verified === true,
  };
}

// ---------- The round trip cookie ----------

const REQUEST_COOKIE = "oauth_request";
const REQUEST_MINUTES = 10;

function cookieKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return new TextEncoder().encode(secret);
}

export async function saveOAuthRequest(req: OAuthRequest) {
  const token = await new SignJWT({ ...req, purpose: "oauth-request" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REQUEST_MINUTES}m`)
    .sign(cookieKey());
  (await cookies()).set(REQUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: REQUEST_MINUTES * 60,
    // Lax: the provider sends the browser back with a normal top level GET.
    sameSite: "lax",
    path: "/api/auth/oauth",
  });
}

/** The saved request (used once: the cookie is removed), or null. */
export async function takeOAuthRequest(provider: OAuthProvider): Promise<OAuthRequest | null> {
  const store = await cookies();
  const token = store.get(REQUEST_COOKIE)?.value;
  store.delete({ name: REQUEST_COOKIE, path: "/api/auth/oauth" });
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, cookieKey(), { algorithms: ["HS256"] });
    if (payload.purpose !== "oauth-request" || payload.provider !== provider) return null;
    return payload as unknown as OAuthRequest;
  } catch {
    return null;
  }
}
