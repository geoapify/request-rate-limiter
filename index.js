async function rateLimitedRequests(requests, maxRequests, interval, options) {
    validateArguments(maxRequests, interval, requests);
    batchState = {
        batchItemsToFire: [],
        batchEndIndex: 0,
        totalRequests: requests.length
    }
    const result = new Array(requests.length);
    const promises = [];

    for (let startIndex = 0; startIndex < requests.length; startIndex += maxRequests) {
        const endIndex = startIndex + maxRequests;
        const batch = requests.slice(startIndex, endIndex).map((execute, index) =>
            execute().then(res => {
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

function onBatchCompleteFired(batchState, result, startIndex, endIndex, batchSize, onBatchComplete) {
    batchState.batchItemsToFire.push(...result);

    while (batchState.batchItemsToFire.length >= batchSize) {
        const batch = batchState.batchItemsToFire.splice(0, batchSize);
        const result = {
            startIndex: batchState.batchEndIndex,
            stopIndex: batchState.batchEndIndex + batchSize - 1,
            results: batch
        }
        batchState.batchEndIndex += batchSize;
        onBatchComplete(result);
    }
}

function onProgressFired(batchState, result, endIndex, onProgress) {
    const data = {
        totalRequests: batchState.totalRequests,
        completedRequests: endIndex
    }
    onProgress(data);
}

function onBatchFinish(batchState, batch, options, startIndex, endIndex) {
    Promise.all(batch).then(result => {
        if (options && options.batchSize && options.onBatchComplete) {
            onBatchCompleteFired(batchState, result, startIndex, endIndex, options.batchSize, options.onBatchComplete);
        }
        if (options && options.onProgress) {
            onProgressFired(batchState, result, endIndex, options.onProgress);
        }
    })
}

function validateArguments(maxRequests, interval, requests) {
    if (maxRequests < 1) throw new Error('"maxRequests" must be at least 1');
    if (interval <= 0) throw new Error('"interval" must be positive number');
    if (!requests || requests.length === 0) throw new Error('"requests" must be an array of functions to execute');
}

module.exports = rateLimitedRequests