package com.moontvplus.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private FrameLayout root;
    private WebView webView;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private ServerConfig serverConfig;
    private String lastErrorDescription = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        setContentView(root);

        serverConfig = new ServerConfig(this);
        String savedUrl = serverConfig.getServerUrl();
        if (savedUrl.isEmpty()) {
            showSetup();
        } else {
            loadSite(savedUrl);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        webView = new WebView(this);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " MoonTVPlusAndroidApp WebView");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    lastErrorDescription = error.getDescription() == null
                            ? "" : error.getDescription().toString();
                    showError();
                }
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // Android 5.x (API 21-22) 回调
                if (failingUrl != null && failingUrl.equals(view.getUrl())) {
                    lastErrorDescription = description == null ? "" : description;
                    showError();
                }
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                // 视频全屏时允许横屏
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                webView.setVisibility(View.GONE);
                root.addView(customView, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                ));
            }

            @Override
            public void onHideCustomView() {
                hideCustomView();
            }
        });
    }

    private void loadSite(String url) {
        if (webView == null) {
            setupWebView();
        }
        root.removeAllViews();
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(ServerConfig.normalizeUrl(url));
    }

    private void showSetup() {
        root.removeAllViews();
        View setupView = getLayoutInflater().inflate(R.layout.server_setup, root, false);
        root.addView(setupView);

        EditText input = setupView.findViewById(R.id.server_url_input);
        Button confirm = setupView.findViewById(R.id.server_url_confirm);

        String current = serverConfig.getServerUrl();
        input.setText(current.isEmpty() ? BuildConfig.BASE_URL : current);
        input.setSelection(input.getText().length());

        confirm.setOnClickListener(v -> {
            String url = ServerConfig.normalizeUrl(input.getText().toString());
            if (url.isEmpty()) {
                input.setError("请输入服务器地址");
                return;
            }
            serverConfig.setServerUrl(url);
            loadSite(url);
        });
    }

    private void showError() {
        root.removeAllViews();
        View errorView = getLayoutInflater().inflate(R.layout.load_error, root, false);
        root.addView(errorView);

        TextView detail = errorView.findViewById(R.id.error_detail);
        String serverUrl = serverConfig.getServerUrl();
        String message = "连接 " + serverUrl + " 失败";
        if (!lastErrorDescription.isEmpty()) {
            message += "\n" + lastErrorDescription;
        }
        message += "\n请确认服务端已启动，且手机与服务端处于同一网络";
        detail.setText(message);

        errorView.findViewById(R.id.error_retry).setOnClickListener(v -> loadSite(serverUrl));
        errorView.findViewById(R.id.error_change_server).setOnClickListener(v -> showSetup());
    }

    private void hideCustomView() {
        if (customView == null) {
            return;
        }
        root.removeView(customView);
        customView = null;
        webView.setVisibility(View.VISIBLE);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // 退出视频全屏后恢复竖屏
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        if (customViewCallback != null) {
            customViewCallback.onCustomViewHidden();
            customViewCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            hideCustomView();
            return;
        }
        if (webView != null && webView.getVisibility() == View.VISIBLE && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
