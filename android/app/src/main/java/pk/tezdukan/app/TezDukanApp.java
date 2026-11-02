package pk.tezdukan.app;

import android.app.Application;
import android.content.Context;
import android.util.Log;

/**
 * Keeps the last crash's stack trace so the next launch can show it (see LauncherActivity):
 * shopkeepers can screenshot it instead of us needing a cable and adb.
 */
public class TezDukanApp extends Application {
    static final String PREFS = "crash";
    static final String KEY_TRACE = "trace";

    @Override
    public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        final Context context = getApplicationContext();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                context.getSharedPreferences(PREFS, MODE_PRIVATE)
                        .edit()
                        .putString(KEY_TRACE, Log.getStackTraceString(error))
                        .commit();
            } catch (Throwable ignored) {
                // Saving the report must never hide the original crash.
            }
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }
}
