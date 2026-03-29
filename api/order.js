const https = require('https');

// GitHub Gist for persistent storage
const GIST_ID = 'placeholder'; // Will be auto-created
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Simple in-memory cache (Vercel ephemeral, but helps during same instance)
let memoryCache = null;

function gistRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'point-order-bot',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      }
    };
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve(d); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getOrders() {
  // Check memory cache first
  if (memoryCache) return memoryCache;

  if (!GIST_ID || GIST_ID === 'placeholder') {
    return { orders: [], lastId: 0, gistId: null };
  }

  try {
    const gist = await gistRequest('GET', `/gists/${GIST_ID}`);
    const file = gist.files && gist.files['orders.json'];
    if (file && file.content) {
      memoryCache = JSON.parse(file.content);
      return memoryCache || { orders: [], lastId: 0, gistId: GIST_ID };
    }
  } catch (e) {
    console.log('Gist read error:', e.message);
  }
  return { orders: [], lastId: 0, gistId: GIST_ID };
}

async function saveOrders(data) {
  // Update memory cache
  memoryCache = data;

  if (!GITHUB_TOKEN || GIST_ID === 'placeholder') return;

  const content = JSON.stringify(data, null, 2);
  const fileContent = { 'orders.json': { content } };

  try {
    if (!GIST_ID) {
      // Create new gist
      const gist = await gistRequest('POST', '/gists', {
        public: false,
        description: 'point-order data',
        files: fileContent
      });
      memoryCache.gistId = gist.id;
      console.log('Created gist:', gist.id);
    } else {
      // Update existing gist
      await gistRequest('PATCH', `/gists/${GIST_ID}`, { files: fileContent });
    }
  } catch (e) {
    console.error('Gist write error:', e.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - 获取所有订单
  if (req.method === 'GET') {
    const data = await getOrders();
    return res.status(200).json(data);
  }

  // POST - 创建新订单
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { items, buyer, note } = body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: '订单内容不能为空' });
      }

      const data = await getOrders();
      const newOrder = {
        id: data.lastId + 1,
        items,
        buyer: buyer || '匿名',
        note: note || '',
        time: new Date().toISOString(),
        status: 'new',
      };

      data.orders.unshift(newOrder);
      data.lastId = newOrder.id;
      await saveOrders(data);

      return res.status(200).json({ success: true, order: newOrder });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PATCH - 更新订单状态
  if (req.method === 'PATCH') {
    try {
      const { id, status } = req.body || {};
      const data = await getOrders();
      const order = data.orders.find(o => o.id === id);
      if (!order) return res.status(404).json({ error: '订单不存在' });

      order.status = status || order.status;
      await saveOrders(data);
      return res.status(200).json({ success: true, order });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: '不支持该请求方法' });
};
