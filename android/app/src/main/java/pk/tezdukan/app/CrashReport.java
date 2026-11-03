package pk.tezdukan.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * Crash reports go to the TezDukan server, never onto the screen: a shopkeeper should only
 * ever see the app. A report saved by one launch is sent quietly by the next.
 */
final class CrashReport {
    static final String PREFS = "crash";
    static final String KEY_TRACE = "trace";
    private static final int MAX_TRACE = 8000;

    private CrashReport() {}

    static void save(Context context, Throwable error) {
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_TRACE, Log.getStackTraceString(error))
                    .commit();
        } catch (Throwable ignored) {
            // Saving the report must never cause a second crash.
        }
    }

    /** Sends a saved report in the background and forgets it once the server has it. */
    static void sendPending(Context context) {
        final Context app = context.getApplicationContext();
        final SharedPreferences prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        final String trace = prefs.getString(KEY_TRACE, null);
        if (trace == null) return;
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                JSONObject body = new JSONObject();
                body.put("version", BuildConfig.VERSION_NAME);
                body.put("device", Build.MANUFACTURER + " " + Build.MODEL);
                body.put("android", Build.VERSION.SDK_INT);
                body.put("trace", trace.length() > MAX_TRACE ? trace.substring(0, MAX_TRACE) : trace);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);

                connection = (HttpURLConnection) new URL(app.getString(R.string.crash_url)).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(10_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(bytes);
                }
                if (connection.getResponseCode() / 100 == 2) prefs.edit().remove(KEY_TRACE).apply();
            } catch (Throwable ignored) {
                // Offline or the server is down: keep the report for the next launch.
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "crash-report").start();
    }
}
