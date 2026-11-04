plugins {
    id("com.android.application")
}

// TezDukan for Android is a Trusted Web Activity: the installed app opens the TezDukan
// site full-screen in Chrome's engine, so the phone app and the website are the same code,
// updates ship with every web deploy, and web push arrives as app notifications.
val twaHost: String = providers.gradleProperty("twaHost").get()

// Must match /.well-known/assetlinks.json on the site. When it does, Android trusts the app
// with the site and hides the browser bar.
val assetStatements =
    """[{ \"relation\": [\"delegate_permission/common.handle_all_urls\"], """ +
        """\"target\": { \"namespace\": \"web\", \"site\": \"https://$twaHost\" } }]"""

android {
    namespace = "pk.tezdukan.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "pk.tezdukan.app"
        minSdk = 24
        targetSdk = 36
        versionCode = providers.gradleProperty("versionCode").get().toInt()
        versionName = providers.gradleProperty("versionName").get()

        resValue("string", "launch_url", "https://$twaHost/")
        resValue("string", "crash_url", "https://$twaHost/api/app-crash")
        resValue("string", "asset_statements", assetStatements)
        manifestPlaceholders["hostName"] = twaHost
    }

    // The upload key lives outside the repository. Keep the keystore and its password safe:
    // every Play Store update must be signed with the same key.
    signingConfigs {
        create("release") {
            System.getenv("TEZDUKAN_KEYSTORE")?.let { path ->
                storeFile = file(path)
                storePassword = System.getenv("TEZDUKAN_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TEZDUKAN_KEY_ALIAS") ?: "tezdukan"
                keyPassword =
                    System.getenv("TEZDUKAN_KEY_PASSWORD") ?: System.getenv("TEZDUKAN_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release").takeIf { it.storeFile != null }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
    implementation("com.google.androidbrowserhelper:locationdelegation:1.1.1")
}
