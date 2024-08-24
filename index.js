async function rateLimitedRequests(requests, maxRequests, interval, options) {
    const result = new Array(requests.length);
    const promises = [];

    for (let startIndex = 0; startIndex < requests.length; startIndex += maxRequests) {
        const endIndex = startIndex + maxRequests;
        const batch = requests.slice(startIndex, endIndex).map((execute, index) =>
            execute().then(res => {
                result[startIndex + index] = res;
                if(options && options.batchSize && options.onBatchComplete) {
                    onBatchCompleteFired(result, startIndex, endIndex, options.batchSize, options.onBatchComplete);
                }
                if(options && options.onProgress) {
                    onProgressFired(result, startIndex, endIndex, options.onProgress);
                }
            })
        );

        promises.push(...batch);

        if (endIndex < requests.length) {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }

    await Promise.all(promises);
    return result;
}

function onBatchCompleteFired(result, startIndex, endIndex, batchSize, onBatchComplete) {
    //     TODO: implement this part
}

function onProgressFired(result, startIndex, endIndex, onProgress) {
    //     TODO: implement this part
}

module.exports = rateLimitedRequests