package com.hestia.control;

import android.os.Bundle;
import android.net.http.SslError;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.JavascriptInterface;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.widget.FrameLayout;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import java.net.URLEncoder;

public class MainActivity extends BridgeActivity {
    private WebView panelWebView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Status Bar Fix
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#252F3D"));
        WindowCompat.setDecorFitsSystemWindows(window, true);

        // 2. Debugging
        WebView.setWebContentsDebuggingEnabled(true);

        // 3. Add JS Bridge to the main Capacitor WebView
        // This allows React to call: window.AndroidBridge.open(url) or .close()
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void open(String url) {
                openDevicePanel(url);
            }
            @JavascriptInterface
            public void close() {
                closeDevicePanel();
            }
        }, "AndroidBridge");
    }

    public void openDevicePanel(final String url) {
        runOnUiThread(() -> {
            if (panelWebView == null) {
                panelWebView = new WebView(this);
                
                float density = getResources().getDisplayMetrics().density;
                int topMargin = (int) (100 * density); 

                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                );
                params.topMargin = topMargin;

                panelWebView.setLayoutParams(params);
                panelWebView.setBackgroundColor(Color.WHITE);

                WebSettings s = panelWebView.getSettings();
                s.setJavaScriptEnabled(true);
                s.setDomStorageEnabled(true);
                s.setDatabaseEnabled(true);
                s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                s.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

                CookieManager.getInstance().setAcceptThirdPartyCookies(panelWebView, true);

                panelWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageStarted(WebView view, String url, Bitmap favicon) {
                        getBridge().getWebView().post(() -> 
                            getBridge().getWebView().loadUrl("javascript:window.dispatchEvent(new CustomEvent('panelLoading', {detail: true}));")
                        );
                        super.onPageStarted(view, url, favicon);
                    }

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        CookieManager.getInstance().flush();
                        getBridge().getWebView().post(() -> 
                            getBridge().getWebView().loadUrl("javascript:window.dispatchEvent(new CustomEvent('panelLoading', {detail: false}));")
                        );
                        super.onPageFinished(view, url);
                    }

                    @Override
                    public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                        handler.proceed();
                    }

                    @Override
                    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                        if (request.isForMainFrame()) {
                            try {
                                String failedUrl = request.getUrl().toString();
                                closeDevicePanel();
                                getBridge().getWebView().post(() ->
                                    getBridge().getWebView().loadUrl("https://localhost/?error=true&failedUrl=" + URLEncoder.encode(failedUrl))
                                );
                            } catch (Exception e) { closeDevicePanel(); }
                        }
                    }
                });

                ((ViewGroup) getWindow().getDecorView().findViewById(android.R.id.content)).addView(panelWebView);
            }
            panelWebView.setVisibility(View.VISIBLE);
            panelWebView.loadUrl(url);
        });
    }

    public void closeDevicePanel() {
        runOnUiThread(() -> {
            if (panelWebView != null) {
                panelWebView.setVisibility(View.GONE);
                panelWebView.loadUrl("about:blank");
                // Notify React
                getBridge().getWebView().post(() -> {
                    getBridge().getWebView().loadUrl("javascript:window.dispatchEvent(new CustomEvent('panelLoading', {detail: false}));");
                    getBridge().getWebView().loadUrl("javascript:window.dispatchEvent(new CustomEvent('panelClosed'));");
                });
            }
        });
    }
    
    @Override
    public void onBackPressed() {
        if (panelWebView != null && panelWebView.getVisibility() == View.VISIBLE) {
            if (panelWebView.canGoBack()) {
                panelWebView.goBack();
            } else {
                closeDevicePanel();
            }
        } else {
            super.onBackPressed();
        }
    }
}
