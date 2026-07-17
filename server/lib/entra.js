import crypto from 'node:crypto';
import { createSessionToken } from './cookies.js';

const DEFAULT_CLOCK_SKEW_SECONDS = 60;
const DEFAULT_CACHE_SECONDS = 3600;
const DEFAULT_ISSUER_HOST = 'https://login.microsoftonline.com';
let jwksCache = null;

function configured(name) {
  return String(process.env[name] || '').trim();
}

function tenantIssuer(tenantId) {
  return `${DEFAULT_ISSUER_HOST}/${tenantId}/v2.0`;
}

function tenantJwksUrl(tenantId) {
  return `${DEFAULT_ISSUER_HOST}/${tenantId}/discovery/v2.0/keys`;
}

export function getEntraConfig() {
  const tenantId = configured('ENTRA_TENANT_ID');
  const clientId = configured('ENTRA_CLIENT_ID');
  return {
    tenantId,
    clientId,
    issuer: configured('ENTRA_ISSUER') || (tenantId ? tenantIssuer(tenantId) : ''),
    jwksUrl: configured('ENTRA_JWKS_URL') || (tenantId ? tenantJwksUrl(tenantId) : ''),
    adminGroupId: configured('ENTRA_ADMIN_GROUP_ID'),
    userGroupId: configured('ENTRA_USER_GROUP_ID'),
    clockSkewSeconds: Number(configured('ENTRA_CLOCK_SKEW_SECONDS') || DEFAULT_CLOCK_SKEW_SECONDS),
    cacheSeconds: Number(configured('ENTRA_JWKS_CACHE_SECONDS') || DEFAULT_CACHE_SECONDS),
  };
}

export function getEntraAdapterStatus() {
  const config = getEntraConfig();
  const ready = Boolean(
    config.tenantId
    && config.clientId
    && config.issuer
    && config.jwksUrl
    && config.adminGroupId
    && config.userGroupId,
  );
  return {
    ready,
    configured: Boolean(config.tenantId || config.clientId || config.adminGroupId || config.userGroupId),
    claims: ['iss', 'aud', 'tid', 'exp', 'nbf', 'groups'],
    roleMapping: { admin: Boolean(config.adminGroupId), user: Boolean(config.userGroupId) },
  };
}

function decodeJsonPart(value, errorCode) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new Error(errorCode);
  }
}

function parseJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error('entra_token_malformed');
  return {
    encodedHeader: parts[0],
    encodedPayload: parts[1],
    signature: Buffer.from(parts[2], 'base64url'),
    header: decodeJsonPart(parts[0], 'entra_token_malformed'),
    claims: decodeJsonPart(parts[1], 'entra_token_malformed'),
  };
}

async function fetchJwks(config, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('entra_fetch_unavailable');
  const now = Date.now();
  if (jwksCache && jwksCache.url === config.jwksUrl && jwksCache.expiresAt > now) return jwksCache.keys;
  let parsedUrl;
  try { parsedUrl = new URL(config.jwksUrl); } catch { throw new Error('entra_jwks_url_invalid'); }
  if (parsedUrl.protocol !== 'https:') throw new Error('entra_jwks_url_invalid');
  const response = await fetchImpl(parsedUrl, { headers: { accept: 'application/json' } });
  if (!response?.ok) throw new Error('entra_jwks_unavailable');
  const body = await response.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  if (!keys.length) throw new Error('entra_jwks_empty');
  jwksCache = {
    url: config.jwksUrl,
    keys,
    expiresAt: now + Math.max(60, config.cacheSeconds) * 1000,
  };
  return keys;
}

function findKey(keys, kid) {
  const jwk = keys.find((candidate) => candidate?.kid === kid && candidate?.kty === 'RSA');
  if (!jwk) throw new Error('entra_signing_key_not_found');
  try {
    return crypto.createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw new Error('entra_signing_key_invalid');
  }
}

function hasClaimValue(value, expected) {
  return Array.isArray(value) ? value.includes(expected) : value === expected;
}

function validateClaims(claims, config, now = Math.floor(Date.now() / 1000)) {
  const skew = Number.isFinite(config.clockSkewSeconds) ? Math.max(0, config.clockSkewSeconds) : DEFAULT_CLOCK_SKEW_SECONDS;
  if (claims.iss !== config.issuer) throw new Error('entra_issuer_invalid');
  if (!hasClaimValue(claims.aud, config.clientId)) throw new Error('entra_audience_invalid');
  if (claims.tid !== config.tenantId) throw new Error('entra_tenant_invalid');
  if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) < now - skew) throw new Error('entra_token_expired');
  if (claims.nbf !== undefined && Number(claims.nbf) > now + skew) throw new Error('entra_token_not_yet_valid');
  if (!claims.oid && !claims.sub) throw new Error('entra_subject_missing');
  if (claims._claim_names?.groups || claims.hasgroups) throw new Error('entra_groups_overage_requires_graph');
  const groups = Array.isArray(claims.groups) ? claims.groups : [];
  const role = groups.includes(config.adminGroupId) ? 'admin' : groups.includes(config.userGroupId) ? 'user' : null;
  if (!role) throw new Error('entra_group_not_authorized');
  return { groups, role };
}

export async function authenticateEntraToken(token, { fetchImpl, now } = {}) {
  const config = getEntraConfig();
  if (!getEntraAdapterStatus().ready) throw new Error('entra_adapter_not_configured');
  const parsed = parseJwt(token);
  if (parsed.header.alg !== 'RS256' || parsed.header.typ !== 'JWT' || !parsed.header.kid) throw new Error('entra_token_header_invalid');
  const keys = await fetchJwks(config, fetchImpl);
  const publicKey = findKey(keys, parsed.header.kid);
  const signingInput = Buffer.from(`${parsed.encodedHeader}.${parsed.encodedPayload}`);
  const validSignature = crypto.verify('RSA-SHA256', signingInput, publicKey, parsed.signature);
  if (!validSignature) throw new Error('entra_signature_invalid');
  const { role } = validateClaims(parsed.claims, config, now);
  const username = String(parsed.claims.preferred_username || parsed.claims.email || parsed.claims.upn || parsed.claims.oid || parsed.claims.sub);
  return {
    username,
    role,
    token: createSessionToken({ username, role }),
  };
}

export function resetEntraJwksCache() {
  jwksCache = null;
}
