package com.moontvplus.app;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * 运行时服务器地址配置，存储在 SharedPreferences 中。
 * 首次启动或连接失败时可在应用内修改，无需重新打包。
 */
public class ServerConfig {
    private static final String PREFS_NAME = "moontv_server";
    private static final String KEY_SERVER_URL = "server_url";

    private final SharedPreferences prefs;

    public ServerConfig(Context context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public String getServerUrl() {
        return prefs.getString(KEY_SERVER_URL, "");
    }

    public void setServerUrl(String url) {
        prefs.edit().putString(KEY_SERVER_URL, normalizeUrl(url)).apply();
    }

    /**
     * 规范化服务器地址：补全协议头、去掉末尾斜杠。
     */
    public static String normalizeUrl(String rawUrl) {
        String url = rawUrl == null ? "" : rawUrl.trim();
        if (url.isEmpty()) {
            return url;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
        }
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }
}
