const rateLimitedRequests = require('../index');

jest.setTimeout(30000);

const maxRetries = 2; // number of retries, if it is 2, then in total we will see 3 requests (1 initial + 2 retries)
const retryDelayInMillis = 500;
const requestURL = `https://www.google.com/`;

test('execute 100 requests', async () => {
    const requests = generateRequests(100);

    const options = {
        batchSize: null,
        onProgress: (progress) => {
            console.log(progress);
        },
        onBatchComplete: (batch) => {
            console.log(batch);
        }
    }
    let result = await rateLimitedRequests(requests, 25, 1000, options);
    expect(result.length).toBe(100);
});

test('execute 100 requests with batch', async () => {
    const requests = generateRequests(100);

    const options = {
        batchSize: 10,
        onProgress: () => {
        },
        onBatchComplete: () => {
        }
    }
    let result = await rateLimitedRequests(requests, 25, 1000, options);
    expect(result.length).toBe(100);
//     TODO: finalize test
});

function generateRequests(numberOfRequests) {
    let result = [];
    for(let i = 0; i < numberOfRequests; i++) {
        result.push( () => makeRequest());
    }
    return result;
}

async function makeRequest(attempt = 1) {
    try {
        const response = await fetch(requestURL);
        if (!response.ok) {
            throw new Error(`HTTP error occured Status: ${response.status}`);
        }
        const data = await response.json();
        return data.features.length ? data.features[0] : {error: "Not found"};
    } catch (error) {
        if (attempt <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelayInMillis));
            return makeRequest(attempt + 1);
        } else {
            return {error: error.toString()};
        }
    }
}