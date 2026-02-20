
export const FREE_BOT_LIMIT = 999999;

/**
 * CORE LOGIC: ALWAYS TRUE.
 * This app is now 100% free. All premium logic is bypassed.
 */
export const isPremium = (): boolean => true;

export const getPremiumStatusText = (): string => "SoulSync Unlimited";

// Fixed: Added durationMs parameter to match usage in PremiumModal.tsx and prevent "Expected 0 arguments, but got 1" error.
export const activateSubscription = (durationMs: number = 0) => {};

export const enableDeveloperMode = () => {
    localStorage.setItem('soulsync_is_dev', 'true');
};

export const disableDeveloperMode = () => {
    localStorage.setItem('soulsync_is_dev', 'false');
};

export const checkDevPassword = (password: string): boolean => {
    if (password === "17022005@787") {
        enableDeveloperMode();
        return true;
    }
    return false;
};

export const getRemainingTime = (): number => 999999999;

export const checkAndHandleExpiration = (): boolean => false;

export const isDeveloperMode = (): boolean => {
    // Default to enabled (true) if not explicitly set to 'false'
    return localStorage.getItem('soulsync_is_dev') !== 'false';
};

export const expireSession = () => {};