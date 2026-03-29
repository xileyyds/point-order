const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'xileyyds';
const REPO_NAME = 'point-order';
const BRANCH = 'main';
const DATA_FILE = 'data-orders.json';

function githubReq(method, path, data) {
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
  if (!GITHUB_TOKEN) return { orders: [], lastId: 0 };
  try {
    const path = `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}?ref=${BRANCH}`;
    const r = await githubReq('GET', path);
    if (r.content) {
      return JSON.parse(Buffer.from(r.content, 'base64').toString('utf8'));
    }
  } catch (e) {}
  return { orders: [], lastId: 0 };
}

async function saveData(data) {
  if (!GITHUB_TOKEN) return;
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const path = `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}`;
  let sha = null;
  try {
    const existing = await githubReq('GET', `${path}?ref=${BRANCH}`);
    sha = existing.sha;
  } catch {}
  const body = { message: 'update orders', content, branch: BRANCH, ...(sha ? { sha } : {}) };
  await githubReq('PUT', path, body);
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
