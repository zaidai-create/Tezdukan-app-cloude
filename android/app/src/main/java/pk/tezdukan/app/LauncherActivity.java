package pk.tezdukan.app;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

/**
 * Opens TezDukan in a Trusted Web Activity. It never shows an error screen: if starting the
 * app fails, the error is reported quietly and the site opens in the browser instead.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private boolean visible;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        CrashReport.sendPending(this);
        try {
            super.onCreate(savedInstanceState);
        } catch (RuntimeException error) {
            CrashReport.save(this, error);
            // The app may already be on screen (the library can fail after launching it). Only
            // fall back to the browser if nothing covered this invisible activity.
            new Handler(Looper.getMainLooper()).postDelayed(this::openInBrowserIfStuck, 1500);
            return;
        }
        // A fixed orientation on a translucent activity crashes Android 8.0, so only above it.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        }
    }

    /** Tells the site which app version opened it, so it can offer an update when one exists. */
    @Override
    protected Uri getLaunchingUrl() {
        Uri url = super.getLaunchingUrl();
        if (url == null || url.getQueryParameter("app") != null) return url;
        return url.buildUpon()
                .appendQueryParameter("app", String.valueOf(BuildConfig.VERSION_CODE))
                .build();
    }

    @Override
    protected void onResume() {
        super.onResume();
        visible = true;
    }

    @Override
    protected void onPause() {
        visible = false;
        super.onPause();
    }

    private void openInBrowserIfStuck() {
        if (isFinishing() || !visible) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(getString(R.string.launch_url))));
        } catch (RuntimeException ignored) {
            // No browser at all: nothing more we can do.
        }
        finish();
    }
}
