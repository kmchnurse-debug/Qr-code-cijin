import { getStore } from '@netlify/blobs';
import { json, verifyRequest } from './_auth.mjs';

const store = () => getStore('storeroom-items');

async function listItems() {
  const s = store();
  const { blobs } = await s.list();
  const items = (await Promise.all(blobs.map(({ key }) => s.get(key, { type: 'json' })))).filter(Boolean);
  return items.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant'));
}

export default async (req) => {
  try {
    if (req.method === 'GET') return json({ items: await listItems() });
    if (!await verifyRequest(req)) return json({ error: 'UNAUTHORIZED' }, 401);
    const s = store();

    if (req.method === 'POST' || req.method === 'PUT') {
      let item;
      try { item = await req.json(); } catch { return json({ error: 'INVALID_JSON' }, 400); }
      if (!item?.id || !item?.name || !item?.code || !item?.category) return json({ error: 'MISSING_FIELDS' }, 400);
      if (!['門診', '病房', '洗腎室', '急診'].includes(item.category)) return json({ error: 'INVALID_CATEGORY' }, 400);
      await s.setJSON(String(item.id), item);
      return json({ items: await listItems() });
    }

    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id');
      if (!id) return json({ error: 'MISSING_ID' }, 400);
      await s.delete(id);
      return json({ items: await listItems() });
    }

    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
};
