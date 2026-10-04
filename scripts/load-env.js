/*
 * 统一加载 .env 文件（供自定义服务器 server.js 与初始化脚本共用）。
 *
 * 背景：Node.js 不会自动加载 .env；而 server.js 在 Next.js 加载环境变量之前
 * 就会初始化 SQLite。此外 Windows 系统自带 USERNAME 环境变量（默认不被
 * dotenv 覆盖），会与 .env 中的 USERNAME 冲突，导致站长账号被错误初始化为
 * Windows 用户名。因此这里显式加载，并让 .env 文件中的值优先于系统环境变量。
 */
const fs = require('fs');
const path = require('path');

function parseEnvContent(content) {
  const result = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

function loadAppEnv(dir = process.cwd()) {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // 加载顺序与 Next.js 保持一致，后面的文件覆盖前面的
  const candidates = [
    '.env',
    '.env.local',
    `.env.${nodeEnv}`,
    `.env.${nodeEnv}.local`,
  ];

  for (const file of candidates) {
    const fullPath = path.join(dir, file);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const parsed = parseEnvContent(fs.readFileSync(fullPath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value; // .env 文件优先于系统环境变量
    }
  }
}

module.exports = { loadAppEnv };
