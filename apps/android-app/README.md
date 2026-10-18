# MoonTVPlus Android App（手机版）

极简 Android 手机 WebView 壳工程，用于打开 MoonTVPlus 主站页面（竖屏）。

服务端（含数据库、直播源等全部数据）部署在电脑或服务器上，App 通过局域网/公网连接，
因此直播源等数据天然保留在服务端，无需迁移。

## 构建参数

- `BASE_URL`: 服务端 Base URL，仅作为应用内默认地址，例如 `https://example.com` 或 `http://192.168.1.10:3000`
- `APP_NAME`: 桌面显示名称
- `VERSION_NAME`: APK 版本名
- `VERSION_CODE`: APK 版本号，整数
- `MIN_SDK`: 最低 Android API，标准版为 `23`（Android 6+），兼容版为 `21`（Android 5+）

## 特性

- 竖屏显示，视频全屏播放时自动切换横屏，退出全屏恢复竖屏
- 首次启动可在应用内填写服务器地址；连接失败时可重试或修改地址（地址变更无需重新打包）
- 使用系统 Android WebView，体积小
- 允许 HTTP 明文访问（局域网 HTTP 服务端）
- 允许 HTTPS 页面加载 HTTP 视频/图片等混合内容
- 使用 `public/logo.png` 作为图标来源
- User-Agent 追加 `MoonTVPlusAndroidApp WebView`

## 本地构建

```bash
gradle assembleDebug -PBASE_URL="http://192.168.1.10:3000"
```

## 使用说明

1. 先在电脑上启动 MoonTVPlus 服务端（默认监听 `0.0.0.0:3000`）
2. 手机与电脑连接同一 WiFi
3. 安装 APK，首次启动输入服务端地址（如 `http://电脑IP:3000`）
4. 之后若电脑 IP 变化导致连接失败，可在失败页面直接修改地址
