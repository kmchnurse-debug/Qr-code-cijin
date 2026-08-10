import crypto from 'node:crypto';

const b64u = (input) => Buffer.from(input).toString('base64url');
const sign = (payload, secret) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

export function createToken(username) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_NOT_CONFIGURED');
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ sub: username, exp: Math.floor(Date.now()/1000) + 60*60*12 }));
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${sign(unsigned, secret)}`;
}

export function verifyToken(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const [h,b,s] = token.split('.'); if (!h || !b || !s) return false;
  const unsigned = `${h}.${b}`;
  const expected = sign(unsigned, secret);
  if (s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return false;
  try { const p = JSON.parse(Buffer.from(b,'base64url').toString('utf8')); return p.exp > Date.now()/1000; } catch { return false; }
}
