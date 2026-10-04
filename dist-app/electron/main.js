/* eslint-disable no-console */
/*
 * MoonTVPlus 桌面端主进程
 *
 * 结构：Electron 壳 + 内置 Node.js 运行时运行应用自带的 start.js（Next.js 自定义
 * 服务器 + Socket.IO）。使用独立 node.exe 而非在主进程内 require，是为了让
 * better-sqlite3 等原生模块继续使用 Node ABI 的预编译产物，避免 electron-rebuild。
 */
const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

// appRoot：打包后为 resources/app，开发时为项目根目录
const appRoot = path.join(__dirname, '..');
const isPackaged = app.isPackaged;

const userDataDir = app.getPath('userData');
const logDir = path.join(userDataDir, 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'server.log');

function log(...args) {
  const line = `[${new Date().toISOString()}] [main] ${args.join(' ')}`;
  console.log(line);
  try {
    fs.appendFileSync(logFile, `${line}\n`);
  } catch {
    /* 忽略日志写入失败 */
  }
}

let serverProcess = null;
let mainWindow = null;
let serverPort = null;
let quitting = false;

// 从期望端口开始找一个可用端口，避免与用户本机已有服务冲突
function findFreePort(preferred, maxTries = 20) {
  return new Promise((resolve, reject) => {
    const tryPort = (port, triesLeft) => {
      const tester = net
        .createServer()
        .once('error', () => {
          if (triesLeft <= 0) {
            reject(new Error('找不到可用端口'));
          } else {
            tryPort(port + 1, triesLeft - 1);
          }
        })
        .once('listening', () => {
          tester.close(() => resolve(port));
        })
        .listen(port, '0.0.0.0');
    };
    tryPort(preferred, maxTries);
  });
}

function waitForServer(port, timeoutMs = 120000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/login', timeout: 2000 },
        (res) => {
          res.resume();
          resolve();
        }
      );
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (serverProcess && serverProcess.exitCode !== null) {
        reject(new Error(`服务器进程已退出，退出码：${serverProcess.exitCode}`));
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('等待服务器启动超时'));
        return;
      }
      setTimeout(poll, 1000);
    };
    poll();
  });
}

function startServer(port) {
  // 打包后使用内置 node.exe；开发时回退到系统 node
  const bundledNode = path.join(appRoot, 'node', 'node.exe');
  const nodeBin = fs.existsSync(bundledNode) ? bundledNode : 'node';

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
    PORT: String(port),
    // 数据落到用户数据目录，保证便携包/安装包场景下可写且持久
    SQLITE_DB_PATH:
      process.env.SQLITE_DB_PATH || path.join(userDataDir, 'moontv.db'),
    OFFLINE_DOWNLOAD_DIR:
      process.env.OFFLINE_DOWNLOAD_DIR || path.join(userDataDir, 'downloads'),
  };

  log(`启动服务器：${nodeBin} start.js（端口 ${port}）`);

  serverProcess = spawn(nodeBin, [path.join(appRoot, 'start.js')], {
    cwd: appRoot,
    env,
    windowsHide: true,
  });

  serverProcess.stdout.on('data', (chunk) => {
    const text = chunk.toString().trimEnd();
    console.log(text);
    try {
      fs.appendFileSync(logFile, `${text}\n`);
    } catch {
      /* 忽略 */
    }
  });
  serverProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString().trimEnd();
    console.error(text);
    try {
      fs.appendFileSync(logFile, `${text}\n`);
    } catch {
      /* 忽略 */
    }
  });
  serverProcess.on('exit', (code, signal) => {
    log(`服务器进程退出：code=${code} signal=${signal}`);
    if (!quitting) {
      dialog.showErrorBox(
        'MoonTVPlus 服务器已停止',
        `服务进程意外退出（code=${code}）。日志：${logFile}`
      );
      app.quit();
    }
  });
}

function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }
  log('停止服务器进程');
  if (process.platform === 'win32') {
    // /T 终止进程树，避免遗留子进程
    execFile('taskkill', ['/pid', String(serverProcess.pid), '/T', '/F'], () => {});
  } else {
    serverProcess.kill('SIGTERM');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    icon: path.join(appRoot, 'public', 'logo.png'),
    webPreferences: {
      // 纯展示远端页面，不需要 Node 集成
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 外部链接交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 单实例：重复双击时聚焦已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const preferredPort = parseInt(process.env.PORT || '3000', 10);
      serverPort = await findFreePort(preferredPort);
      if (serverPort !== preferredPort) {
        log(`端口 ${preferredPort} 被占用，改用 ${serverPort}`);
      }
      startServer(serverPort);
      await waitForServer(serverPort);
      createWindow();
    } catch (error) {
      log('启动失败：', error && error.stack ? error.stack : String(error));
      dialog.showErrorBox(
        'MoonTVPlus 启动失败',
        `${error.message || error}\n\n日志：${logFile}`
      );
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('will-quit', () => {
    quitting = true;
    stopServer();
  });
}
