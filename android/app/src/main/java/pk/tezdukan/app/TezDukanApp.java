package pk.tezdukan.app;

import android.app.Application;

/** Keeps the last crash so the next launch can report it to the server (see CrashReport). */
public class TezDukanApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            CrashReport.save(getApplicationContext(), error);
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }
}
