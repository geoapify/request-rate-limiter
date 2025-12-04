/**
 * Basic JavaScript Example - Request Rate Limiter
 * 
 * This example demonstrates how to use @geoapify/request-rate-limiter
 * to throttle API requests and prevent 429 errors.
 */

const { rateLimitedRequests } = require('../../dist/request-rate-limiter');

// Simulate API requests (replace with your actual API calls)
function mockApiRequest(id) {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`✓ Request ${id} completed`);
            resolve({
                id: id,
                data: `Result ${id}`,
                timestamp: new Date().toISOString()
            });
        }, Math.random() * 100 + 50);
    });
}

// Create an array of request functions
const requests = [];
for (let i = 0; i < 20; i++) {
    requests.push(() => mockApiRequest(i));
}

// Configure options
const options = {
    batchSize: 5,
    onProgress: (progress) => {
        console.log(`📊 Progress: ${progress.completedRequests}/${progress.totalRequests} completed`);
    },
    onBatchComplete: (batch) => {
        console.log(`✅ Batch complete: indices ${batch.startIndex}-${batch.stopIndex}`);
    }
};

// Execute with rate limiting
console.log('🚀 Starting rate-limited requests...\n');
console.log('Configuration:');
console.log('  - Total requests: 20');
console.log('  - Max requests per interval: 5');
console.log('  - Interval: 1000ms');
console.log('  - Batch size: 5\n');

rateLimitedRequests(
    requests,
    5,      // max 5 requests
    1000,   // per 1000ms (1 second)
    options
)
.then(results => {
    console.log(`\n🎉 All requests completed!`);
    console.log(`📦 Total results: ${results.length}`);
})
.catch(error => {
    console.error('❌ Error:', error.message);
});

