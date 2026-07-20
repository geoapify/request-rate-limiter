import { rateLimitedRequests, Options, ProgressData, BatchResult, RequestResult as RateLimitedResult } from '../src/request-rate-limiter';
import mockFetch from './mock-fetch';

jest.setTimeout(60000);

const maxRetries = 2; // number of retries, if it is 2, then in total we will see 3 requests (1 initial + 2 retries)
const retryDelayInMillis = 500;
const requestURL = `https://httpbin.org/get`;

interface RequestResult {
    args?: Record<string, string | string[]>;
    error?: string;
}

test('execute 50 requests', async () => {
    const requests = generateRequests(50);
    const options = createOptions(null, null, null);

    let result = await rateLimitedRequests<RequestResult>(requests, 25, 1000, options);

    expect(result.length).toBe(50);
    expect(isResponseContainData(result, 0, 49)).toBe(true);
});

test('execute 1000 requests', async () => {
    const requests = generateRequests(1000);
    const batchItems: BatchResult<RequestResult>[] = [];
    const progressItems: ProgressData[] = [];
    const options = createOptions(50, (progress) => progressItems.push(progress), (batch) => batchItems.push(batch));

    let result = await rateLimitedRequests<RequestResult>(requests, 100, 1000, options);

    expect(result.length).toBe(1000);
    expect(isResponseContainData(result, 0, 999)).toBe(true);
    checkBatchItems(batchItems, 50, 1000);
    checkProgressItems(progressItems, 100, 1000, 10);
});

test('execute 50 requests with batch', async () => {
    const requests = generateRequests(50);
    const batchItems: BatchResult<RequestResult>[] = [];
    const options = createOptions(10, () => {}, (batch) => batchItems.push(batch));

    let result = await rateLimitedRequests<RequestResult>(requests, 25, 1000, options);

    expect(result.length).toBe(50);
    expect(batchItems.length).toBe(5);
    checkBatchItems(batchItems, 10, 50);
});

test('execute 50 requests with batch (batchSize bigger than total requests)', async () => {
    const requests = generateRequests(50);
    const batchItems: BatchResult<RequestResult>[] = [];

    const options = createOptions(60, () => {}, (batch) => batchItems.push(batch));

    let result = await rateLimitedRequests<RequestResult>(requests, 25, 1000, options);
    expect(result.length).toBe(50);
    expect(batchItems.length).toBe(1);
    expect(batchItems[0].startIndex).toBe(0);
    expect(batchItems[0].stopIndex).toBe(49);
    expect(batchItems[0].results.length).toBe(50);
});

test('execute 50 requests with batch (batchSize equals to total requests)', async () => {
    const requests = generateRequests(50);
    const batchItems: BatchResult<RequestResult>[] = [];

    const options = createOptions(50, () => {}, (batch) => batchItems.push(batch));

    let result = await rateLimitedRequests<RequestResult>(requests, 25, 1000, options);
    expect(result.length).toBe(50);
    expect(batchItems.length).toBe(1);
    isBatchResponseContainData(batchItems, 0, 49);
});

test('execute 50 requests with batch and expect onProgress callback', async () => {
    const requests = generateRequests(50);
    const progressItems: ProgressData[] = [];

    const options = createOptions(50, (progress) => progressItems.push(progress), null);

    let result = await rateLimitedRequests<RequestResult>(requests, 25, 1000, options);
    expect(result.length).toBe(50);
    checkProgressItems(progressItems, 25, 50, 2);
});

test('execute 5 request, options not passed', async () => {
    const requests = generateRequests(5);

    let result = await rateLimitedRequests<RequestResult>(requests, 25, 1000);

    expect(result.length).toBe(5);
});

test('execute 5 request, maxRequests = 0', async () => {
    const requests = generateRequests(5);

    await expect(rateLimitedRequests<RequestResult>(requests, 0, 1000)).rejects.toThrow('"maxRequests" must be a positive integer');
});

test('execute 5 request, interval = 0', async () => {
    const requests = generateRequests(5);

    await expect(rateLimitedRequests<RequestResult>(requests, 1, 0)).rejects.toThrow('"interval" must be positive number');
});

test('execute 5 request, requests is empty array', async () => {
    await expect(rateLimitedRequests<RequestResult>([], 1, 1000)).rejects.toThrow('"requests" must be an array of functions to execute');
});

test('continue processing when a request rejects', async () => {
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (error: unknown) => unhandledRejections.push(error);
    process.on('unhandledRejection', onUnhandledRejection);

    try {
        const requests = [
            () => Promise.resolve('first'),
            () => Promise.reject(new Error('failed')),
            () => Promise.resolve('third')
        ];
        const progressItems: ProgressData[] = [];
        const batchItems: BatchResult<string>[] = [];

        const result = await rateLimitedRequests<string>(requests, 1, 10, {
            batchSize: 2,
            onProgress: (progress) => progressItems.push(progress),
            onBatchComplete: (batch) => batchItems.push(batch)
        });

        await new Promise(resolve => setTimeout(resolve, 20));

        expect(result[0]).toBe('first');
        expect(result[1]).toBeInstanceOf(Error);
        expect((result[1] as Error).message).toBe('failed');
        expect(result[2]).toBe('third');
        expect(progressItems.map(item => item.completedRequests)).toEqual([1, 2, 3]);
        expect(batchItems.map(item => [item.startIndex, item.stopIndex])).toEqual([[0, 1], [2, 2]]);
        expect(unhandledRejections).toEqual([]);
    } finally {
        process.off('unhandledRejection', onUnhandledRejection);
    }
});

test('fire onBatchComplete for the final partial batch', async () => {
    const requests = Array.from({ length: 25 }, (_, index) => () => index);
    const batchItems: BatchResult<number>[] = [];

    const result = await rateLimitedRequests<number>(requests, 25, 1000, {
        batchSize: 10,
        onBatchComplete: (batch) => batchItems.push(batch)
    });

    expect(result.length).toBe(25);
    expect(batchItems.map(item => [item.startIndex, item.stopIndex, item.results.length])).toEqual([
        [0, 9, 10],
        [10, 19, 10],
        [20, 24, 5]
    ]);
});

test('reject invalid batchSize', async () => {
    const requests = generateRequests(5);

    await expect(rateLimitedRequests<RequestResult>(requests, 1, 1000, { batchSize: 0 })).rejects.toThrow('"batchSize" must be a positive integer');
    await expect(rateLimitedRequests<RequestResult>(requests, 1, 1000, { batchSize: -1 })).rejects.toThrow('"batchSize" must be a positive integer');
    await expect(rateLimitedRequests<RequestResult>(requests, 1, 1000, { batchSize: 1.5 })).rejects.toThrow('"batchSize" must be a positive integer');
});

test('reject invalid maxConcurrentRequests', async () => {
    const requests = generateRequests(5);

    await expect(rateLimitedRequests<RequestResult>(requests, 1, 1000, { maxConcurrentRequests: 0 })).rejects.toThrow('"maxConcurrentRequests" must be a positive integer');
    await expect(rateLimitedRequests<RequestResult>(requests, 1, 1000, { maxConcurrentRequests: -1 })).rejects.toThrow('"maxConcurrentRequests" must be a positive integer');
    await expect(rateLimitedRequests<RequestResult>(requests, 1, 1000, { maxConcurrentRequests: 1.5 })).rejects.toThrow('"maxConcurrentRequests" must be a positive integer');
});

test('include undefined request results in batches', async () => {
    const requests = [
        () => undefined,
        () => 1
    ];
    const batchItems: BatchResult<number | undefined>[] = [];

    const result = await rateLimitedRequests<number | undefined>(requests, 2, 1000, {
        batchSize: 2,
        onBatchComplete: (batch) => batchItems.push(batch)
    });

    expect(result).toEqual([undefined, 1]);
    expect(batchItems.length).toBe(1);
    expect(batchItems[0].results).toEqual([undefined, 1]);
});

test('do not start a later group until the current group has completed', async () => {
    let resolveFirstRequest: (value: number) => void = () => {};
    const startedRequests: number[] = [];
    const requests = [
        () => new Promise<number>(resolve => {
            startedRequests.push(0);
            resolveFirstRequest = resolve;
        }),
        () => {
            startedRequests.push(1);
            return 1;
        },
        () => {
            startedRequests.push(2);
            return 2;
        },
        () => {
            startedRequests.push(3);
            return 3;
        }
    ];
    const batchItems: BatchResult<number>[] = [];

    const resultPromise = rateLimitedRequests<number>(requests, 1, 1, {
        batchSize: 2,
        onBatchComplete: (batch) => batchItems.push(batch)
    });

    await new Promise(resolve => setTimeout(resolve, 40));
    expect(startedRequests).toEqual([0]);
    expect(batchItems).toEqual([]);

    resolveFirstRequest(0);
    const result = await resultPromise;

    expect(result).toEqual([0, 1, 2, 3]);
    expect(startedRequests).toEqual([0, 1, 2, 3]);
    expect(batchItems.map(item => [item.startIndex, item.stopIndex])).toEqual([[0, 1], [2, 3]]);
});

test('limit active requests with maxConcurrentRequests', async () => {
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const requests = Array.from({ length: 6 }, (_, index) => async () => {
        activeRequests++;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await new Promise(resolve => setTimeout(resolve, 10));
        activeRequests--;
        return index;
    });

    const result = await rateLimitedRequests<number>(requests, 6, 1000, {
        maxConcurrentRequests: 2
    });

    expect(result).toEqual([0, 1, 2, 3, 4, 5]);
    expect(maxActiveRequests).toBe(2);
});

test('keep progress and batch state isolated across concurrent invocations', async () => {
    const firstProgressItems: ProgressData[] = [];
    const secondProgressItems: ProgressData[] = [];
    const firstBatchItems: BatchResult<number>[] = [];
    const secondBatchItems: BatchResult<string>[] = [];

    const first = rateLimitedRequests<number>(
        [() => 0, () => 1, () => 2, () => 3],
        2,
        1,
        {
            batchSize: 2,
            onProgress: (progress) => firstProgressItems.push(progress),
            onBatchComplete: (batch) => firstBatchItems.push(batch)
        }
    );
    const second = rateLimitedRequests<string>(
        [() => 'a', () => 'b', () => 'c'],
        2,
        1,
        {
            batchSize: 2,
            onProgress: (progress) => secondProgressItems.push(progress),
            onBatchComplete: (batch) => secondBatchItems.push(batch)
        }
    );

    await expect(first).resolves.toEqual([0, 1, 2, 3]);
    await expect(second).resolves.toEqual(['a', 'b', 'c']);
    expect(firstProgressItems).toEqual([
        { totalRequests: 4, completedRequests: 2 },
        { totalRequests: 4, completedRequests: 4 }
    ]);
    expect(secondProgressItems).toEqual([
        { totalRequests: 3, completedRequests: 2 },
        { totalRequests: 3, completedRequests: 3 }
    ]);
    expect(firstBatchItems.map(item => [item.startIndex, item.stopIndex, item.results])).toEqual([
        [0, 1, [0, 1]],
        [2, 3, [2, 3]]
    ]);
    expect(secondBatchItems.map(item => [item.startIndex, item.stopIndex, item.results])).toEqual([
        [0, 1, ['a', 'b']],
        [2, 2, ['c']]
    ]);
});


function isResponseContainData(result: RateLimitedResult<RequestResult>[], startIndex: number, endIndex: number): boolean {
    for (let i = startIndex; i <= endIndex; i++) {
        const item = result[i - startIndex];
        if (!item || item instanceof Error || !item.args) {
            return false;
        }
        const id = item.args['id'];
        if (id !== `${i}`) {
            return false;
        }
    }
    return true;
}

function generateRequests(numberOfRequests: number): (() => Promise<RequestResult>)[] {
    let result: (() => Promise<RequestResult>)[] = [];
    for (let i = 0; i < numberOfRequests; i++) {
        result.push(() => makeRequest(i));
    }
    return result;
}

function isBatchResponseContainData(batchItems: BatchResult<RequestResult>[], startIndex: number, endIndex: number): boolean {
    for (let i = 0; i < batchItems.length; i++) {
        let batchItem = batchItems[i];
        if (batchItem.startIndex === startIndex && batchItem.stopIndex === endIndex) {
            if (isResponseContainData(batchItem.results, startIndex, endIndex)) {
                return true;
            }
        }
    }
    return false;
}

async function makeRequest(requestId: number, attempt: number = 1): Promise<RequestResult> {
    try {
        const response = await mockFetch(requestURL + '?id=' + requestId);
        if (!response.ok) {
            throw new Error(`HTTP error occured Status: ${response.ok}`);
        }
        return await response.json();
    } catch (error) {
        if (attempt <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelayInMillis));
            return makeRequest(requestId, attempt + 1);
        } else {
            return { error: error?.toString() };
        }
    }
}

function checkProgressItems(progressItems: ProgressData[], maxRequests: number, totalRequests: number, expectedProgressItemsCount: number): void {
    expect(progressItems.length).toBe(expectedProgressItemsCount);
    for (let i = 0; i < expectedProgressItemsCount; i++) {
        expect(progressItems[i].totalRequests).toBe(totalRequests);
        expect(progressItems[i].completedRequests).toBe((1 + i) * maxRequests);
    }
}

function checkBatchItems(batchItems: BatchResult<RequestResult>[], batchSize: number, totalRequests: number): void {
    for (let i = 0; i < totalRequests; i = i + batchSize) {
        const endIndex = Math.min(i + batchSize - 1, totalRequests - 1);
        let result = isBatchResponseContainData(batchItems, i, endIndex);
        if (!result) {
            console.log("items " + JSON.stringify(batchItems));
            console.log(`startIndex ${i}, endIndex ${endIndex}`);
        }
        expect(result).toBe(true);
    }
}

function createOptions(
    batchSize: number | null,
    onProgress: ((progress: ProgressData) => void) | null,
    onBatchComplete: ((batch: BatchResult<RequestResult>) => void) | null
): Options<RequestResult> | undefined {
    if (batchSize === null && onProgress === null && onBatchComplete === null) {
        return undefined;
    }
    return {
        batchSize: batchSize ?? undefined,
        onProgress: onProgress ?? undefined,
        onBatchComplete: onBatchComplete ?? undefined
    };
}
