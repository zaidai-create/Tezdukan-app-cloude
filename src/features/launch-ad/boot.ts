/** Session flag: the opening ad has been shown in this tab. */
export const LAUNCH_AD_KEY = "td-launch-ad";
/** Class on <html> that hides the opening ad (seen this session, or an automated browser). */
export const LAUNCH_AD_SEEN_CLASS = "td-ad-seen";

/**
 * Runs before first paint, just before the ad in the server HTML: hides it when it was already
 * shown in this tab, so a reload never flashes it. Automated browsers (tests, crawlers) skip it
 * unless the address asks for it with ?launchAd=1.
 */
export const launchAdBootScript = `(function(){var h=document.documentElement;try{var f=location.search.indexOf("launchAd=1")>-1;if(!f&&(navigator.webdriver||sessionStorage.getItem("${LAUNCH_AD_KEY}")))h.classList.add("${LAUNCH_AD_SEEN_CLASS}")}catch(e){h.classList.add("${LAUNCH_AD_SEEN_CLASS}")}})();`;
