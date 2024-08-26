const rateLimitedRequests = require('../index');

jest.setTimeout(60000);

const maxRetries = 2; // number of retries, if it is 2, then in total we will see 3 requests (1 initial + 2 retries)
const retryDelayInMillis = 500;
const requestURL = `https://httpbin.org/get`;

test('execute 50 requests', async () => {
    const requests = generateRequests(50);
    const options = createOptions(null, null, null);

    let result = await rateLimitedRequests(requests, 25, 1000, options);

    expect(result.length).toBe(50);
    expectResponseToContainData(result, 0, 49);
});

test('execute 1000 requests', async () => {
    const requests = generateRequests(1000);
    const options = createOptions(null, null, null);

    let result = await rateLimitedRequests(requests, 100, 1000, options);

    expect(result.length).toBe(1000);
    expectResponseToContainData(result, 0, 999);
});

test('execute 50 requests with batch', async () => {
    const requests = generateRequests(50);
    const batchItems = [];
    const options = createOptions(10, () => {}, (batch) => batchItems.push(batch));

    let result = await rateLimitedRequests(requests, 25, 1000, options);

    expect(result.length).toBe(50);
    expect(batchItems.length).toBe(5);
    expectBatchResponseToContainData(batchItems, 0,0,9);
    expectBatchResponseToContainData(batchItems, 1,10,19);
    expectBatchResponseToContainData(batchItems, 2,20,29);
    expectBatchResponseToContainData(batchItems, 3,30,39);
    expectBatchResponseToContainData(batchItems, 4,40,49);
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
    expectBatchResponseToContainData(batchItems, 0,0,49);
});

test('execute 50 requests with batch and expect onProgress callback', async () => {
    const requests = generateRequests(50);
    const progressItems = [];

    const options = createOptions(50, (progress) => progressItems.push(progress), null);

    let result = await rateLimitedRequests(requests, 25, 1000, options);
    expect(result.length).toBe(50);
    expect(progressItems.length).toBe(2);
    expect(progressItems[0].totalRequests).toBe(50);
    expect(progressItems[0].completedRequests).toBe(25);
    expect(progressItems[1].totalRequests).toBe(50);
    expect(progressItems[1].completedRequests).toBe(50);
});

function expectResponseToContainData(result, startIndex, endIndex) {
    for(let i = startIndex; i <= endIndex; i++){
        expect(JSON.stringify(result[i - startIndex])).toContain(`{"args":{"id":"${i}"}`);
    }
}

function generateRequests(numberOfRequests) {
    let result = [];
    for(let i = 0; i < numberOfRequests; i++) {
        result.push( () => makeRequest(i));
    }
    return result;
}

function expectBatchResponseToContainData(batchItems, index, startIndex, endIndex) {
    expectResponseToContainData(batchItems[index].results, startIndex, endIndex);
    expect(batchItems[index].startIndex).toBe(startIndex);
    expect(batchItems[index].stopIndex).toBe(endIndex);
}

async function makeRequest(requestId, attempt = 1) {
    try {
        const response = await fetch(requestURL + '?id=' + requestId);
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

function createOptions(batchSize, onProgress, onBatchComplete) {
    return {
        batchSize: batchSize,
        onProgress: onProgress,
        onBatchComplete: onBatchComplete
    };
}