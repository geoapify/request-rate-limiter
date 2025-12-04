/**
 * Basic TypeScript Example - Request Rate Limiter
 * 
 * This example demonstrates how to use @geoapify/request-rate-limiter
 * with full TypeScript type safety.
 */

import { rateLimitedRequests, Options, ProgressData, BatchResult, RequestFunction } from '../../dist/request-rate-limiter';

// Define a custom type for our API response
interface ApiResponse {
    id: number;
    data: string;
    timestamp: string;
}

// Simulate API request with proper typing
function mockApiRequest(id: number): Promise<ApiResponse> {
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

// Create typed request functions
const requests: RequestFunction<ApiResponse>[] = [];
for (let i = 0; i < 20; i++) {
    requests.push(() => mockApiRequest(i));
}

// Configure typed options
const options: Options<ApiResponse> = {
    batchSize: 5,
    onProgress: (progress: ProgressData) => {
        console.log(`📊 Progress: ${progress.completedRequests}/${progress.totalRequests} completed`);
    },
    onBatchComplete: (batch: BatchResult<ApiResponse>) => {
        console.log(`✅ Batch complete: indices ${batch.startIndex}-${batch.stopIndex}`);
        // batch.results is typed as ApiResponse[]
        console.log(`   First result in batch: ${batch.results[0].data}`);
    }
};

// Execute with full type safety
async function runDemo(): Promise<void> {
    console.log('🚀 Starting rate-limited requests with TypeScript...\n');
    console.log('Configuration:');
    console.log('  - Total requests: 20');
    console.log('  - Max requests per interval: 5');
    console.log('  - Interval: 1000ms');
    console.log('  - Batch size: 5\n');

    try {
        // results is typed as ApiResponse[]
        const results: ApiResponse[] = await rateLimitedRequests<ApiResponse>(
            requests,
            5,      // max 5 requests
            1000,   // per 1000ms
            options
        );

        console.log(`\n🎉 All requests completed!`);
        console.log(`📦 Total results: ${results.length}`);
        
        // TypeScript knows the structure of results
        results.forEach(result => {
            console.log(`   - ID: ${result.id}, Data: ${result.data}`);
        });
    } catch (error) {
        console.error('❌ Error:', (error as Error).message);
    }
}

runDemo();

