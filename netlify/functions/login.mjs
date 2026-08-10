import { configuredCredentials, createToken, json } from './_auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const { username: expectedUser, password: expectedPassword, secret } = configuredCredentials();
  if (!expectedUser || !expectedPassword || !secret) return json({ error: 'ADMIN_NOT_CONFIGURED' }, 503);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'INVALID_JSON' }, 400); }
  if (body?.username !== expectedUser || body?.password !== expectedPassword) return json({ error: 'INVALID_CREDENTIALS' }, 401);
  return json({ token: await createToken(expectedUser) });
};
