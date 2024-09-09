const { rateLimitedRequests } = require('../src/request-rate-limiter');
const mockFetch = require('./mock-fetch');

jest.setTimeout(60000);

const maxRetries = 2; // number of retries, if it is 2, then in total we will see 3 requests (1 initial + 2 retries)
const retryDelayInMillis = 500;
const requestURL = `https://httpbin.org/get`;

test('execute 50 requests', async () => {
    const requests = generateRequests(50);
    const options = createOptions(null, null, null);

    let result = await rateLimitedRequests(requests, 25, 1000, options);

    expect(result.length).toBe(50);
    expect(isResponseContainData(result, 0, 49)).toBe(true);
});

test('execute 1000 requests', async () => {
    const requests = generateRequests(1000);
    const batchItems = [];
    const progressItems = [];
    const options = createOptions(50, (progress) => progressItems.push(progress), (batch) => batchItems.push(batch));

    let result = await rateLimitedRequests(requests, 100, 1000, options);

    expect(result.length).toBe(1000);
    expect(isResponseContainData(result, 0, 999)).toBe(true);
    checkBatchItems(batchItems, 50, 1000);
    checkProgressItems(progressItems, 100, 1000, 10);
});

test('execute 50 requests with batch', async () => {
    const requests = generateRequests(50);
    const batchItems = [];
    const options = createOptions(10, () => {}, (batch) => batchItems.push(batch));

    let result = await rateLimitedRequests(requests, 25, 1000, options);

    expect(result.length).toBe(50);
    expect(batchItems.length).toBe(5);
    checkBatchItems(batchItems, 10, 50);
});

test('execute 50 requests with batch (batchSize bigger than total requests)', async () => {
    const requests = generateRequests(50);
    const batchItems = [];

    const options = createOptions(60, () => {}, (batch) => batchItems.push(batch));

    let result = await rateLimitedRequests(requests, 25, 1000, options);
    expect(result.length).toBe(50);
    expect(batchItems.length).toBe(0);
});

test('execute 50 requests with batch (batchSize equals to total requests)', async () => {
    const requests = generateRequests(50);
    const batchItems = [];

    const options = createOptions(50, () => {}, (batch) => batchItems.push(batch));

    let result = await rateLimitedRequests(requests, 25, 1000, options);
    expect(result.length).toBe(50);
    expect(batchItems.length).toBe(1);
    isBatchResponseContainData(batchItems,0,49);
});

test('execute 50 requests with batch and expect onProgress callback', async () => {
    const requests = generateRequests(50);
    const progressItems = [];

    const options = createOptions(50, (progress) => progressItems.push(progress), null);

    let result = await rateLimitedRequests(requests, 25, 1000, options);
    expect(result.length).toBe(50);
    checkProgressItems(progressItems, 25, 50, 2);
});

test('execute 5 request, options not passed', async () => {
    const requests = generateRequests(5);

    let result = await rateLimitedRequests(requests, 25, 1000);

    expect(result.length).toBe(5);
});

test('execute 5 request, maxRequests = 0', async () => {
    const requests = generateRequests(5);

    await expect(rateLimitedRequests(requests, 0, 1000)).rejects.toThrow('"maxRequests" must be at least 1');
});

test('execute 5 request, interval = 0', async () => {
    const requests = generateRequests(5);

    await expect(rateLimitedRequests(requests, 1, 0)).rejects.toThrow('"interval" must be positive number');
});

test('execute 5 request, requests is empty array', async () => {
    await expect(rateLimitedRequests([], 1, 1000)).rejects.toThrow('"requests" must be an array of functions to execute');
});


function isResponseContainData(result, startIndex, endIndex) {
    for(let i = startIndex; i <= endIndex; i++){
        let resultItem = JSON.stringify(result[i - startIndex]);
        if(!resultItem || !resultItem.includes(`{"args":{"id":"${i}"}`)) {
            return false;
        }
    }
    return true;
}

function generateRequests(numberOfRequests) {
    let result = [];
    for(let i = 0; i < numberOfRequests; i++) {
        result.push( () => makeRequest(i));
    }
    return result;
}

function isBatchResponseContainData(batchItems, startIndex, endIndex) {
    for(let i = 0; i < batchItems.length; i++) {
        let batchItem = batchItems[i];
        if(batchItem.startIndex === startIndex && batchItem.stopIndex === endIndex) {
            if(isResponseContainData(batchItem.results, startIndex, endIndex)) {
                return true;
            }
        }
    }
    return false;
}

async function makeRequest(requestId, attempt = 1) {
    try {
        const response = await mockFetch(requestURL + '?id=' + requestId);
        if (!response.ok) {
            throw new Error(`HTTP error occured Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (attempt <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelayInMillis));
            return makeRequest(requestId, attempt + 1);
        } else {
            return {error: error.toString()};
        }
    }
}

function checkProgressItems(progressItems, maxRequests, totalRequests, expectedProgressItemsCount) {
    expect(progressItems.length).toBe(expectedProgressItemsCount);
    for(let i = 0; i < expectedProgressItemsCount; i++) {
        expect(progressItems[i].totalRequests).toBe(totalRequests);
        expect(progressItems[i].completedRequests).toBe((1 + i) * maxRequests);
    }
}

function checkBatchItems(batchItems, batchSize, totalRequests) {
    for(let i = 0; i < totalRequests; i = i + batchSize) {
        let result = isBatchResponseContainData(batchItems, i, i + batchSize - 1);
        if(!result) {
            console.log("items " + JSON.stringify(batchItems));
            console.log(`startIndex ${i}, endIndex ${i + batchSize - 1}`);
        }
        expect(result).toBe(true);
    }
}

function createOptions(batchSize, onProgress, onBatchComplete) {
    return {
        batchSize: batchSize,
        onProgress: onProgress,
        onBatchComplete: onBatchComplete
    };
}