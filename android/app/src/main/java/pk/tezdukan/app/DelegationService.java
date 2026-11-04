package pk.tezdukan.app;

import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;

/**
 * Delivers the site's notifications as app notifications and answers its location requests with
 * the app's own location permission (so "use my current location" works even when Chrome itself
 * has no location access on the phone).
 */
public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    public DelegationService() {
        registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
    }
}
