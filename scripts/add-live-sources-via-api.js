// 通过管理 API 添加直播源（保证服务端内存缓存与数据库一致）
const { loadAppEnv } = require('./load-env.js');
loadAppEnv(); // .env 优先于 Windows 系统自带的 USERNAME 变量

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const USERNAME = process.env.USERNAME || 'admin';
const PASSWORD = process.env.PASSWORD || '123456';

const LIVE_SOURCES = [
  { key: 'vbskycn-ipv4', name: 'vbskycn IPv4', url: 'https://live.zbds.top/tv/iptv4.m3u' },
  { key: 'vbskycn-ipv6', name: 'vbskycn IPv6', url: 'https://live.zbds.top/tv/iptv6.m3u' },
  { key: 'vbskycn-proxy', name: 'vbskycn 代理备用', url: 'https://gh-proxy.com/raw.githubusercontent.com/vbskycn/iptv/refs/heads/master/tv/iptv4.m3u' },
  { key: 'iptv-org-cn', name: 'iptv-org 中国区', url: 'https://iptv-org.github.io/iptv/countries/cn.m3u' },
  { key: 'iptv-org-cn-proxy', name: 'iptv-org 中国区代理', url: 'https://ghproxy.com/https://iptv-org.github.io/iptv/countries/cn.m3u' },
  { key: 'best-fan-cn', name: 'best-fan 国内全部', url: 'https://raw.githubusercontent.com/best-fan/iptv-sources/master/cn_all_status.m3u8' },
  { key: 'best-fan-cn-proxy', name: 'best-fan 国内代理', url: 'https://gh-proxy.org/raw.githubusercontent.com/best-fan/iptv-sources/master/cn_all_status.m3u8' },
  { key: 'guovin-auto', name: 'Guovin 自动生成', url: 'https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/ipv4/result.m3u' },
  { key: 'dianshijia', name: '电视家重生', url: 'https://gh.catmak.name/https://raw.githubusercontent.com/wujiangliu/live-sources/refs/heads/main/电视家.m3u' },
  { key: 'global-live', name: '全球直播', url: 'https://gh.catmak.name/https://raw.githubusercontent.com/wujiangliu/live-sources/refs/heads/main/全球直播.m3u' },
  { key: 'yuechan-cn', name: 'YueChan 国内版', url: 'https://raw.githubusercontent.com/YueChan/Live/refs/heads/main/IPTV.m3u' },
  { key: 'yuechan-aptv', name: 'YueChan APTV 版', url: 'https://raw.githubusercontent.com/YueChan/Live/refs/heads/main/APTV.m3u' },
  { key: 'yuechan-global', name: 'YueChan 国际版', url: 'https://raw.githubusercontent.com/YueChan/Live/refs/heads/main/Global.m3u' },
];

async function main() {
  // 登录拿 cookie
  const loginRes = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!loginRes.ok) {
    console.error('❌ 登录失败:', loginRes.status, await loginRes.text());
    process.exit(1);
  }
  const cookie = (loginRes.headers.getSetCookie?.() || [])
    .map((c) => c.split(';')[0])
    .join('; ');
  if (!cookie) {
    console.error('❌ 未获取到登录 cookie');
    process.exit(1);
  }
  console.log('✅ 登录成功');

  let added = 0;
  for (const src of LIVE_SOURCES) {
    const res = await fetch(`${BASE}/api/admin/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ action: 'add', ...src }),
    });
    const text = await res.text();
    if (res.ok) {
      added++;
      console.log(`✅ 添加: ${src.name}`);
    } else if (text.includes('已存在')) {
      console.log(`⏭️ 已存在，跳过: ${src.name}`);
    } else {
      console.error(`❌ 失败: ${src.name} -> ${res.status} ${text}`);
    }
  }
  console.log(`\n🎉 完成，新增 ${added} 个直播源`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
