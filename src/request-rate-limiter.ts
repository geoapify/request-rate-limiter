import { RequestFunction, Options, BatchState, BatchResult, ProgressData } from './types';

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
): Promise<T[]> {
    validateArguments(maxRequests, interval, requests);
    
    const batchState: BatchState<T> = {
        batchItemsToFire: new Array(requests.length),
        totalRequests: requests.length,
        completedRequests: 0
    };
    
    const result = new Array<T>(requests.length);
    const promises: Promise<T>[] = [];

    for (let startIndex = 0; startIndex < requests.length; startIndex += maxRequests) {
        const endIndex = Math.min(startIndex + maxRequests, requests.length);
        const batch = requests.slice(startIndex, endIndex).map((execute, index) =>
            Promise.resolve(execute()).then(res => {
                result[startIndex + index] = res;
                return res;
            })
        );
        onBatchFinish(batchState, batch, options, startIndex, endIndex);
        promises.push(...batch);

        if (endIndex < requests.length) {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }

    await Promise.all(promises);
    return result;
}

function onBatchCompleteFired<T>(
    batchState: BatchState<T>,
    batchItems: T[],
    startIndex: number,
    endIndex: number,
    batchSize: number,
    onBatchComplete: (batch: BatchResult<T>) => void
): void {
    for (let i = startIndex; i < endIndex; i++) {
        batchState.batchItemsToFire[i] = batchItems[i - startIndex];
    }

    for (let i = 0; i < batchState.batchItemsToFire.length; i = i + batchSize) {
        let batchEndIndex = Math.min(i + batchSize, batchState.batchItemsToFire.length);
        let allItemsArePopulated = ifAllItemsArePopulated(batchState, i, batchEndIndex);
        // Only fire batch if we have a complete batch (or this is the last batch with all items populated)
        if (allItemsArePopulated && batchEndIndex - i === batchSize) {
            const batch = batchState.batchItemsToFire.slice(i, batchEndIndex) as T[];
            const result: BatchResult<T> = {
                startIndex: i,
                stopIndex: batchEndIndex - 1,
                results: batch
            };
            for (let j = 0; j < batchEndIndex; j++) {
                batchState.batchItemsToFire[j] = undefined;
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
        if (i < batchState.batchItemsToFire.length && batchState.batchItemsToFire[i] === undefined) {
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
    batch: Promise<T>[],
    options: Options<T> | undefined,
    startIndex: number,
    endIndex: number
): void {
    Promise.all(batch).then(batchItems => {
        if (options && options.batchSize && options.onBatchComplete) {
            onBatchCompleteFired(batchState, batchItems, startIndex, endIndex, options.batchSize, options.onBatchComplete);
        }
        if (options && options.onProgress) {
            onProgressFired(batchState, startIndex, endIndex, options.onProgress);
        }
    });
}

function validateArguments<T>(
    maxRequests: number,
    interval: number,
    requests: RequestFunction<T>[]
): void {
    if (maxRequests < 1) throw new Error('"maxRequests" must be at least 1');
    if (interval <= 0) throw new Error('"interval" must be positive number');
    if (!requests || requests.length === 0) throw new Error('"requests" must be an array of functions to execute');
}

// Export for CommonJS compatibility
export { rateLimitedRequests };

// Export types
export * from './types';

// Default export for backward compatibility
export default { rateLimitedRequests };

