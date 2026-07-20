import { RequestFunction, Options, BatchState, BatchResult, ProgressData, RequestResult } from './types';

/**
 * Execute a list of requests with rate limiting
 * 
 * @template T The type of data returned by each request
 * @param requests Array of functions that return promises or values
 * @param maxRequests Maximum number of requests to execute within the interval
 * @param interval Time interval in milliseconds
 * @param options Optional configuration for progress tracking and batch processing
 * @returns Promise that resolves to an array of results
 * 
 * @example
 * ```typescript
 * const requests = [
 *   () => fetch('https://api.example.com/1'),
 *   () => fetch('https://api.example.com/2'),
 *   () => fetch('https://api.example.com/3')
 * ];
 * 
 * const results = await rateLimitedRequests(requests, 5, 1000);
 * ```
 */
async function rateLimitedRequests<T = any>(
    requests: RequestFunction<T>[],
    maxRequests: number,
    interval: number,
    options?: Options<T>
): Promise<RequestResult<T>[]> {
    validateArguments(maxRequests, interval, requests, options);
    const maxConcurrentRequests = options?.maxConcurrentRequests ?? maxRequests;
    
    const batchState: BatchState<T> = {
        batchItemsToFire: new Array(requests.length),
        batchItemsReady: new Array(requests.length).fill(false),
        totalRequests: requests.length,
        completedRequests: 0
    };
    
    const result = new Array<RequestResult<T>>(requests.length);

    for (let startIndex = 0; startIndex < requests.length; startIndex += maxRequests) {
        const endIndex = Math.min(startIndex + maxRequests, requests.length);
        const batch = await executeBatch(requests, result, startIndex, endIndex, maxConcurrentRequests);
        onBatchFinish(batchState, batch, options, startIndex, endIndex);

        if (endIndex < requests.length) {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }

    return result;
}

async function executeBatch<T>(
    requests: RequestFunction<T>[],
    result: RequestResult<T>[],
    startIndex: number,
    endIndex: number,
    maxConcurrentRequests: number
): Promise<RequestResult<T>[]> {
    const batchSize = endIndex - startIndex;
    const batchResult = new Array<RequestResult<T>>(batchSize);
    let nextIndex = 0;

    async function runNext(): Promise<void> {
        const index = nextIndex++;
        if (index >= batchSize) {
            return;
        }

        const resultIndex = startIndex + index;
        try {
            const res = await requests[resultIndex]();
            result[resultIndex] = res;
            batchResult[index] = res;
        } catch (error) {
            const res = toError(error);
            result[resultIndex] = res;
            batchResult[index] = res;
        }

        await runNext();
    }

    const workers = Math.min(maxConcurrentRequests, batchSize);
    await Promise.all(Array.from({ length: workers }, runNext));
    return batchResult;
}

function onBatchCompleteFired<T>(
    batchState: BatchState<T>,
    batchItems: RequestResult<T>[],
    startIndex: number,
    endIndex: number,
    batchSize: number,
    onBatchComplete: (batch: BatchResult<T>) => void
): void {
    for (let i = startIndex; i < endIndex; i++) {
        batchState.batchItemsToFire[i] = batchItems[i - startIndex];
        batchState.batchItemsReady[i] = true;
    }

    for (let i = 0; i < batchState.batchItemsToFire.length; i = i + batchSize) {
        let batchEndIndex = Math.min(i + batchSize, batchState.batchItemsToFire.length);
        let allItemsArePopulated = ifAllItemsArePopulated(batchState, i, batchEndIndex);
        if (allItemsArePopulated) {
            const batch = batchState.batchItemsToFire.slice(i, batchEndIndex);
            const result: BatchResult<T> = {
                startIndex: i,
                stopIndex: batchEndIndex - 1,
                results: batch
            };
            for (let j = i; j < batchEndIndex; j++) {
                batchState.batchItemsReady[j] = false;
            }
            onBatchComplete(result);
        }
    }
}

function ifAllItemsArePopulated<T>(
    batchState: BatchState<T>,
    startIndex: number,
    endIndex: number
): boolean {
    for (let i = startIndex; i < endIndex; i++) {
        if (i < batchState.batchItemsReady.length && !batchState.batchItemsReady[i]) {
            return false;
        }
    }
    return true;
}

function onProgressFired<T>(
    batchState: BatchState<T>,
    startIndex: number,
    endIndex: number,
    onProgress: (progress: ProgressData) => void
): void {
    batchState.completedRequests += endIndex - startIndex;
    const data: ProgressData = {
        totalRequests: batchState.totalRequests,
        completedRequests: batchState.completedRequests
    };
    onProgress(data);
}

function onBatchFinish<T>(
    batchState: BatchState<T>,
    batchItems: RequestResult<T>[],
    options: Options<T> | undefined,
    startIndex: number,
    endIndex: number
): void {
    if (options?.batchSize && options.onBatchComplete) {
        onBatchCompleteFired(batchState, batchItems, startIndex, endIndex, options.batchSize, options.onBatchComplete);
    }
    if (options?.onProgress) {
        onProgressFired(batchState, startIndex, endIndex, options.onProgress);
    }
}

function validateArguments<T>(
    maxRequests: number,
    interval: number,
    requests: RequestFunction<T>[],
    options?: Options<T>
): void {
    if (!Number.isInteger(maxRequests) || maxRequests < 1) throw new Error('"maxRequests" must be a positive integer');
    if (!Number.isFinite(interval) || interval <= 0) throw new Error('"interval" must be positive number');
    if (!Array.isArray(requests) || requests.length === 0 || requests.some(request => typeof request !== 'function')) {
        throw new Error('"requests" must be an array of functions to execute');
    }
    if (options?.batchSize !== undefined && (!Number.isInteger(options.batchSize) || options.batchSize < 1)) {
        throw new Error('"batchSize" must be a positive integer');
    }
    if (options?.maxConcurrentRequests !== undefined && (!Number.isInteger(options.maxConcurrentRequests) || options.maxConcurrentRequests < 1)) {
        throw new Error('"maxConcurrentRequests" must be a positive integer');
    }
}

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

// Export for CommonJS compatibility
export { rateLimitedRequests };

// Export types
export * from './types';

// Default export for backward compatibility
export default { rateLimitedRequests };
