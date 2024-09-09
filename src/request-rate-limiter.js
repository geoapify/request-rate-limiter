async function rateLimitedRequests(requests, maxRequests, interval, options) {
    validateArguments(maxRequests, interval, requests);
    batchState = {
        batchItemsToFire: new Array(requests.length),
        totalRequests: requests.length,
        completedRequests: 0
    }
    const result = new Array(requests.length);
    const promises = [];

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

function onBatchCompleteFired(batchState, batchItems, startIndex, endIndex, batchSize, onBatchComplete) {
    for (let i = startIndex; i < endIndex; i++) {
        batchState.batchItemsToFire[i] = batchItems[i - startIndex];
    }

    for (let i = 0; i < batchState.batchItemsToFire.length; i = i + batchSize) {
        let batchEndIndex = i + batchSize;
        let allItemsArePopulated = ifAllItemsArePopulated(batchState, i, batchEndIndex);
        if(allItemsArePopulated) {
            const batch = batchState.batchItemsToFire.slice(i, batchEndIndex);
            const result = {
                startIndex: i,
                stopIndex: Math.min(batchEndIndex - 1, batchState.batchItemsToFire.length - 1),
                results: batch
            }
            for (let j = 0; j < batchEndIndex; j++) {
                batchState.batchItemsToFire[j] = undefined;
            }
            onBatchComplete(result);
        }
    }
}

function ifAllItemsArePopulated(batchState, startIndex, endIndex) {
    for(let i = startIndex; i < endIndex; i++) {
        if(i < batchState.batchItemsToFire.length && batchState.batchItemsToFire[i] === undefined) {
            return false;
        }
    }
    return true;
}

function onProgressFired(batchState, startIndex, endIndex, onProgress) {
    batchState.completedRequests += endIndex - startIndex;
    const data = {
        totalRequests: batchState.totalRequests,
        completedRequests: batchState.completedRequests
    }
    onProgress(data);
}

function onBatchFinish(batchState, batch, options, startIndex, endIndex) {
    Promise.all(batch).then(batchItems => {
        if (options && options.batchSize && options.onBatchComplete) {
            onBatchCompleteFired(batchState, batchItems, startIndex, endIndex, options.batchSize, options.onBatchComplete);
        }
        if (options && options.onProgress) {
            onProgressFired(batchState, startIndex, endIndex, options.onProgress);
        }
    })
}

function validateArguments(maxRequests, interval, requests) {
    if (maxRequests < 1) throw new Error('"maxRequests" must be at least 1');
    if (interval <= 0) throw new Error('"interval" must be positive number');
    if (!requests || requests.length === 0) throw new Error('"requests" must be an array of functions to execute');
}

module.exports = { rateLimitedRequests };