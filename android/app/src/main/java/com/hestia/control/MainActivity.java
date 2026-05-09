package com.hestia.control;

import android.os.Bundle;
import android.net.http.SslError;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
@Override
public void onStart() {
    super.onStart();

    WebView webView = getBridge().getWebView();

    // 1. Storage & JavaScript settings
    webView.getSettings().setDomStorageEnabled(true);
    webView.getSettings().setDatabaseEnabled(true);
    webView.getSettings().setJavaScriptEnabled(true);

    // 2. MIXED CONTENT: This is critical for loading HTTP content inside an HTTPS app
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
        webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }

    // 3. USER AGENT: Some servers block mobile WebViews; this mimics Chrome
    String chromeUA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    webView.getSettings().setUserAgentString(chromeUA);

    // 4. Cookie Configuration
    CookieManager cookieManager = CookieManager.getInstance();
    cookieManager.setAcceptCookie(true);
    cookieManager.setAcceptThirdPartyCookies(webView, true);

    // 5. Safety Override: Bypass SSL errors for local hardware certificates
    webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.proceed();
        }
    });
}

}
