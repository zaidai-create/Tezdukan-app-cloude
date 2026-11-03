/**
 * The newest Android app. Bump with every APK (android/gradle.properties) and put the file at
 * public/download/TezDukan-<versionName>.apk: a new name per version, so no phone or CDN can
 * hand out a cached older file.
 */
export const androidRelease = {
  versionCode: 5,
  versionName: "0.1.4",
  path: "/download/TezDukan-0.1.4.apk",
} as const;

/** Chrome sets this referrer when the installed Android app opens the site. */
export const androidAppReferrer = "android-app://pk.tezdukan.app";

/** Holds the installed app's versionCode; set by the proxy from the app's `?app=` launch URL. */
export const ANDROID_APP_COOKIE = "td_android_app";
