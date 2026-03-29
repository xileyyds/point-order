const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../data/config.json');

// 默认配置
const DEFAULT_CONFIG = {
  owner: '宝贝',
  title: '专属点菜单',
  cats: ['暂未分类', '奶茶', '情绪', '吃的'],
  items: [
    { cat: 0, name: '不知道吃啥，老婆随便点', icon: 'question', sales: '月销 0' },
    { cat: 1, name: '要喝霸王茶姬', icon: 'milkTea', sales: '月销 0' },
    { cat: 1, name: '要喝古茗', icon: 'milkTea', sales: '月销 0' },
    { cat: 1, name: '要喝瑞幸', icon: 'coffee', sales: '月销 0' },
    { cat: 1, name: '要喝喜茶', icon: 'drink', sales: '月销 0' },
    { cat: 1, name: '要喝一点点', icon: 'drink', sales: '月销 0' },
    { cat: 2, name: '抱抱', icon: 'heart', sales: '' },
    { cat: 2, name: '夸夸', icon: 'star', sales: '' },
    { cat: 2, name: '揉揉头', icon: 'hand', sales: '' },
    { cat: 3, name: '火锅', icon: 'hotpot', sales: '' },
    { cat: 3, name: '烧烤', icon: 'bbq', sales: '' },
    { cat: 3, name: '炸鸡', icon: 'chicken', sales: '' },
  ],
  password: 'xiley2026', // 后台管理密码
};

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 初始化配置文件
  if (!fs.existsSync(CONFIG_FILE)) {
    const dataDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }

  // GET - 读取配置（密码验证）
  if (req.method === 'GET') {
    const { password } = req.query;
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

    if (password !== config.password) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 不返回密码
    const { password: _, ...safeConfig } = config;
    return res.status(200).json(safeConfig);
  }

  // POST - 更新配置（密码验证）
  if (req.method === 'POST') {
    const { password, ...updates } = req.body;
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

    if (password !== config.password) {
      return res.status(401).json({ error: '密码错误' });
    }

    const newConfig = { ...config, ...updates };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    return res.status(200).json({ success: true });
  }

  // PUT - 单独更新菜单项
  if (req.method === 'PUT') {
    const { password, items } = req.body;
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

    if (password !== config.password) {
      return res.status(401).json({ error: '密码错误' });
    }

    config.items = items;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return res.status(200).json({ success: true, items });
  }

  res.status(405).json({ error: '不支持该请求方法' });
};
