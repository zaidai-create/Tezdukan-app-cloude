package pk.tezdukan.app;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Opens TezDukan in a Trusted Web Activity. If the last launch crashed, it shows the error
 * (to screenshot for support) with a way to retry or open the site in the browser instead.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private String pendingCrash;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        pendingCrash = getSharedPreferences(TezDukanApp.PREFS, MODE_PRIVATE)
                .getString(TezDukanApp.KEY_TRACE, null);
        try {
            super.onCreate(savedInstanceState);
        } catch (RuntimeException error) {
            pendingCrash = Log.getStackTraceString(error);
        }
        // A fixed orientation on a translucent activity crashes Android 8.0, so only above it.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        }
        if (pendingCrash != null) showCrash(pendingCrash);
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        return pendingCrash == null && super.shouldLaunchImmediately();
    }

    private void showCrash(String trace) {
        int pad = (int) (16 * getResources().getDisplayMetrics().density);
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setPadding(pad, pad * 3, pad, pad);
        column.setBackgroundColor(0xFFFFFFFF);

        TextView title = new TextView(this);
        title.setText("TezDukan could not open. Please send a screenshot of this screen to support.");
        title.setTextSize(18);
        title.setTextColor(0xFF0F1A15);
        column.addView(title);

        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setOnClickListener(v -> {
            getSharedPreferences(TezDukanApp.PREFS, MODE_PRIVATE).edit().clear().commit();
            Intent restart = new Intent(this, LauncherActivity.class);
            restart.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(restart);
            finish();
        });
        column.addView(retry);

        Button browser = new Button(this);
        browser.setText("Open in browser");
        browser.setOnClickListener(v -> startActivity(
                new Intent(Intent.ACTION_VIEW, Uri.parse(getString(R.string.launch_url)))));
        column.addView(browser);

        TextView details = new TextView(this);
        details.setText(Build.MANUFACTURER + " " + Build.MODEL + ", Android " + Build.VERSION.RELEASE
                + " (API " + Build.VERSION.SDK_INT + "), app " + BuildConfig.VERSION_NAME + "\n\n" + trace);
        details.setTextSize(11);
        details.setTypeface(Typeface.MONOSPACE);
        details.setTextColor(0xFF333333);
        details.setTextIsSelectable(true);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(details);
        column.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        getWindow().setBackgroundDrawableResource(android.R.color.white);
        setContentView(column);
    }
}
