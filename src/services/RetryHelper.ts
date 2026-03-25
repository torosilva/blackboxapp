/**
 * RetryHelper: Utilities for handling transient API failures with exponential backoff.
 */
export const RetryHelper = {
    /**
     * Executes an async function with retries on specific error codes (like 429).
     */
    async withRetry<T>(
        fn: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 1000,
        codesToRetry: number[] = [429, 500, 502, 503, 504]
    ): Promise<T> {
        let lastError: any;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;
                const status = error?.response?.status;
                
                // Only retry if it's a transient error code
                if (status && codesToRetry.includes(status) && attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.log(`RETRY_HELPER: Attempt ${attempt + 1} failed with status ${status}. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                throw error;
            }
        }
        
        throw lastError;
    }
};
