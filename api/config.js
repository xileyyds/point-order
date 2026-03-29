const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'xileyyds';
const REPO_NAME = 'point-order';
const BRANCH = 'main';
const CONFIG_FILE = 'data-config.json';

// 通过 GitHub API 读写 repo 文件
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

async function loadConfig() {
  if (!GITHUB_TOKEN) {
    return {
      owner: '宝贝', title: '专属点菜单', cats: ['暂未分类','奶茶','情绪','吃的'],
      items: [
        { cat:0, name:'不知道吃啥，老婆随便点', icon:'question', sales:'月销 0' },
        { cat:1, name:'要喝霸王茶姬', icon:'milkTea', sales:'月销 0' },
        { cat:1, name:'要喝古茗', icon:'milkTea', sales:'月销 0' },
        { cat:1, name:'要喝瑞幸', icon:'coffee', sales:'月销 0' },
        { cat:1, name:'要喝喜茶', icon:'drink', sales:'月销 0' },
        { cat:1, name:'要喝一点点', icon:'drink', sales:'月销 0' },
        { cat:2, name:'抱抱', icon:'heart', sales:'' },
        { cat:2, name:'夸夸', icon:'star', sales:'' },
        { cat:2, name:'揉揉头', icon:'hand', sales:'' },
        { cat:3, name:'火锅', icon:'hotpot', sales:'' },
        { cat:3, name:'烧烤', icon:'bbq', sales:'' },
        { cat:3, name:'炸鸡', icon:'chicken', sales:'' },
      ],
      level: 'Lv.0', password: 'xiley2026'
    };
  }
  try {
    const path = `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CONFIG_FILE}?ref=${BRANCH}`;
    const gist = await githubReq('GET', path);
    if (gist.content) {
      const content = Buffer.from(gist.content, 'base64').toString('utf8');
      return JSON.parse(content);
    }
  } catch (e) { console.error('load config error:', e.message); }
  return null;
}

async function saveConfig(cfg) {
  if (!GITHUB_TOKEN) return;
  const content = Buffer.from(JSON.stringify(cfg, null, 2)).toString('base64');
  const path = `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CONFIG_FILE}`;
  let sha = null;
  try {
    const existing = await githubReq('GET', `${path}?ref=${BRANCH}`);
    sha = existing.sha;
  } catch {}
  const body = {
    message: 'update config',
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {})
  };
  await githubReq('PUT', path, body);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const url = new URL(req.url, 'https://x');
    const pw = url.searchParams.get('password');
    const cfg = await loadConfig();
    if (!cfg) return res.status(200).json({ error: '配置加载失败' });
    if (pw !== cfg.password) return res.status(401).json({ error: '密码错误' });
    const { password: _, ...safe } = cfg;
    return res.status(200).json(safe);
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const cfg = await loadConfig();
        if (!cfg) return res.status(500).json({ error: '配置加载失败' });
        if (parsed.password !== cfg.password) return res.status(401).json({ error: '密码错误' });
        if (parsed.items !== undefined) cfg.items = parsed.items;
        if (parsed.cats !== undefined) cfg.cats = parsed.cats;
        if (parsed.title !== undefined) cfg.title = parsed.title;
        if (parsed.owner !== undefined) cfg.owner = parsed.owner;
        if (parsed.level !== undefined) cfg.level = parsed.level;
        await saveConfig(cfg);
        return res.status(200).json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    });
    return;
  }

  res.status(405).json({ error: '不支持该方法' });
};
