/**
 * Service to manage app locking behavior.
 * Simplified singleton to handle bypass flags globally.
 */
class LockServiceImpl {
    /**
     * Set the bypass flag. When true, the app will not lock itself.
     */
    setBypass(active: boolean) {
        (global as any).__BLACKBOX_BYPASS_ACTIVE = active;
        console.log(`[LOCK_SERVICE] Bypass set to: ${active}`);
    }

    /**
     * Check if the bypass is currently active.
     */
    isBypassActive(): boolean {
        return !!(global as any).__BLACKBOX_BYPASS_ACTIVE;
    }
}

export const LockService = new LockServiceImpl();
