import { getStore } from '@netlify/blobs';
import { json } from './_auth.mjs';

const KEY = 'count';

export default async (req) => {
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const store = getStore('storeroom-visitors');
    const current = (await store.get(KEY, { type: 'json', consistency: 'strong' })) || { count: 0 };
    if (req.method === 'POST') {
      const next = { count: Number(current.count || 0) + 1, updatedAt: new Date().toISOString() };
      await store.setJSON(KEY, next);
      return json(next);
    }
    return json({ count: Number(current.count || 0) });
  } catch (err) {
    console.error(err);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
};
