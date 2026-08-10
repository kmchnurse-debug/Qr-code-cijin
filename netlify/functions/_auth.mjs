const enc = new TextEncoder();

function b64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlText(text) {
  return b64url(enc.encode(text));
}

async function signText(text, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return b64url(new Uint8Array(sig));
}

function env(name) {
  return globalThis.Netlify?.env?.get?.(name) ?? process.env[name];
}

export function configuredCredentials() {
  return {
    username: env('ADMIN_USERNAME') || '',
    password: env('ADMIN_PASSWORD') || '',
    secret: env('ADMIN_SESSION_SECRET') || ''
  };
}

export async function createToken(username) {
  const { secret } = configuredCredentials();
  const payload = b64urlText(JSON.stringify({ sub: username, exp: Date.now() + 8 * 60 * 60 * 1000 }));
  const sig = await signText(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyRequest(req) {
  const { secret } = configuredCredentials();
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = await signText(payload, secret);
  if (sig !== expected) return false;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const data = JSON.parse(atob(padded));
    return Boolean(data.sub && data.exp > Date.now());
  } catch {
    return false;
  }
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
