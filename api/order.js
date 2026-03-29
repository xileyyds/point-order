const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID || null;
let cache = null;

function gistReq(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : undefined;
    const opts = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'point-order',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function loadData() {
  if (cache) return cache;
  if (!GITHUB_TOKEN) return { orders: [], lastId: 0, gistId: null };

  try {
    if (GIST_ID) {
      const gist = await gistReq('GET', `/gists/${GIST_ID}`);
      const f = gist.files && gist.files['orders.json'];
      if (f && f.content) { cache = JSON.parse(f.content); return cache; }
    }
  } catch (e) { console.error('load error:', e.message); }
  return { orders: [], lastId: 0, gistId: GIST_ID };
}

async function saveData(data) {
  cache = data;
  if (!GITHUB_TOKEN) return;
  const content = JSON.stringify(data, null, 2);
  const files = { 'orders.json': { content } };
  try {
    if (!GIST_ID) {
      const gist = await gistReq('POST', '/gists', { public: false, description: 'point-order data', files });
      process.env.GIST_ID = gist.id;
      console.log('Gist created:', gist.id);
    } else {
      await gistReq('PATCH', `/gists/${GIST_ID}`, { files });
    }
  } catch (e) { console.error('save error:', e.message); }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const data = await loadData();
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { items, buyer, note } = JSON.parse(body || '{}');
        if (!items || items.length === 0) return res.status(400).json({ error: '订单内容不能为空' });
        const data = await loadData();
        const newOrder = { id: data.lastId + 1, items, buyer: buyer || '匿名', note: note || '', time: new Date().toISOString(), status: 'new' };
        data.orders.unshift(newOrder);
        data.lastId = newOrder.id;
        await saveData(data);
        return res.status(200).json({ success: true, order: newOrder });
      } catch (e) { return res.status(500).json({ error: e.message }); }
    });
    return;
  }

  if (req.method === 'PATCH') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { id, status } = JSON.parse(body || '{}');
        const data = await loadData();
        const order = data.orders.find(o => o.id === id);
        if (!order) return res.status(404).json({ error: '订单不存在' });
        order.status = status || order.status;
        await saveData(data);
        return res.status(200).json({ success: true, order });
      } catch (e) { return res.status(500).json({ error: e.message }); }
    });
    return;
  }

  res.status(405).json({ error: '不支持该方法' });
};
