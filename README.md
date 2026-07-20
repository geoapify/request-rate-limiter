# @geoapify/request-rate-limiter

A lightweight, zero-dependency JavaScript/TypeScript library for running request functions with rate limits, concurrency limits, progress callbacks, and ordered batch results.

Use it when you have many API calls to make and need to avoid starting too many at once or too many within the same interval.

## Install

```bash
npm install @geoapify/request-rate-limiter
```

## Quick Start

```javascript
const { rateLimitedRequests } = require('@geoapify/request-rate-limiter');

const urls = [
    'https://api.example.com/1',
    'https://api.example.com/2',
    'https://api.example.com/3'
];

const requests = urls.map(url => () => fetch(url));

const results = await rateLimitedRequests(requests, 5, 1000, {
    maxConcurrentRequests: 2
});

for (const result of results) {
    if (result instanceof Error) {
        console.error('Request failed:', result.message);
    } else {
        console.log('Request succeeded:', result);
    }
}
```

Important: pass functions that start requests, not already-started promises. The limiter controls when each function is called.

## Importing

### ESM

```javascript
import RequestRateLimiter from '@geoapify/request-rate-limiter';

const results = await RequestRateLimiter.rateLimitedRequests(requests, 5, 1000);
```

### CommonJS

```javascript
const RequestRateLimiter = require('@geoapify/request-rate-limiter');

const results = await RequestRateLimiter.rateLimitedRequests(requests, 5, 1000);
```

You can also import the named function:

```javascript
const { rateLimitedRequests } = require('@geoapify/request-rate-limiter');
```

### Browser

You can load the UMD bundle from npm CDNs such as unpkg or jsDelivr:

```html
<script src="https://unpkg.com/@geoapify/request-rate-limiter"></script>
```

```html
<script src="https://cdn.jsdelivr.net/npm/@geoapify/request-rate-limiter"></script>
```

The bundle exposes `RequestRateLimiter`.

## API

```typescript
rateLimitedRequests<T>(
    requests: Array<() => T | Promise<T>>,
    maxRequests: number,
    interval: number,
    options?: Options<T>
): Promise<Array<T | Error>>
```

### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `requests` | `Array<() => T \| Promise<T>>` | Functions that start requests when called. |
| `maxRequests` | `number` | Maximum number of requests in one interval group. |
| `interval` | `number` | Delay in milliseconds before the next group can start. |
| `options` | `Options<T>` | Optional progress, batching, and concurrency settings. |

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `maxConcurrentRequests` | `number` | `maxRequests` | Maximum number of requests that may run at the same time. |
| `batchSize` | `number` | none | Number of ordered results per `onBatchComplete` callback. The final batch may be smaller. |
| `onProgress` | `(progress: ProgressData) => void` | none | Called after each completed request group. |
| `onBatchComplete` | `(batch: BatchResult<T>) => void` | none | Called when all items in an ordered result batch are ready. |

## Concurrency And Rate Behavior

`maxRequests` and `maxConcurrentRequests` control different things:

* `maxRequests` controls how many requests are allowed in one interval group.
* `maxConcurrentRequests` controls how many requests from that group may run at the same time.

```javascript
const results = await RequestRateLimiter.rateLimitedRequests(requests, 10, 1000, {
    maxConcurrentRequests: 3
});
```

This allows up to 10 requests per interval group, but never runs more than 3 requests at once. The next interval group starts only after the current group has completed and the interval delay has passed.

## Return Value

The function resolves to an array with the same order as `requests`.

```javascript
const results = await RequestRateLimiter.rateLimitedRequests([
    () => 'first',
    () => 'second'
], 2, 1000);

// results: ['first', 'second']
```

If an individual request throws or rejects, processing continues and the returned result array contains an `Error` object at that request's original index.

## Error Handling

Individual request failures do not stop the limiter. The failure is converted to an `Error` result, and later requests continue to run.

```javascript
const results = await RequestRateLimiter.rateLimitedRequests([
    () => 'ok 1',
    () => Promise.reject(new Error('failed')),
    () => 'ok 2'
], 1, 1000);

// results: ['ok 1', Error('failed'), 'ok 2']
for (const result of results) {
    if (result instanceof Error) {
        console.error('Request failed:', result.message);
    } else {
        console.log('Request succeeded:', result);
    }
}
```

The same `Error` entries are included in `onBatchComplete` results:

```javascript
await RequestRateLimiter.rateLimitedRequests(requests, 5, 1000, {
    batchSize: 2,
    onBatchComplete: (batch) => {
        for (const result of batch.results) {
            if (result instanceof Error) {
                console.error('Batch item failed:', result.message);
            }
        }
    }
});
```

If `onProgress` or `onBatchComplete` throws, the `rateLimitedRequests()` promise rejects. This behavior applies only to callback errors, not individual request errors.

## Callback Timing

`onProgress` is called after a request group completes. Its counts reflect completed requests:

```javascript
{
    totalRequests: 50,
    completedRequests: 25
}
```

`onBatchComplete` is called only after all items in that ordered result batch are ready. If the total number of requests is not divisible by `batchSize`, the final callback contains the remaining items.

```javascript
await RequestRateLimiter.rateLimitedRequests(requests, 5, 1000, {
    batchSize: 2,
    onBatchComplete: (batch) => {
        console.log(batch.startIndex, batch.stopIndex, batch.results);
    }
});
```

## Behavior Notes

* Result order always matches request order.
* `requests` must be functions, not already-started promises.
* Individual request errors do not stop processing.
* Callback errors reject the returned promise.
* `maxRequests`, `maxConcurrentRequests`, and `batchSize` must be positive integers.
* `interval` must be a positive number.
* Each `rateLimitedRequests()` call has isolated progress and batch state.

## Examples

### Basic Logging

```javascript
const RequestRateLimiter = require('@geoapify/request-rate-limiter');

const requests = [
    () => { console.log('One'); return 1; },
    () => { console.log('Two'); return 2; },
    () => { console.log('Three'); return 3; },
    () => { console.log('Four'); return 4; },
    () => { console.log('Five'); return 5; },
    () => { console.log('Six'); return 6; }
];

const options = {
    maxConcurrentRequests: 1,
    batchSize: 2,
    onProgress: (progress) => {
        console.log(`Progress: ${progress.completedRequests}/${progress.totalRequests} completed`);
    },
    onBatchComplete: (batch) => {
        console.log('Batch completed:', batch);
    }
};

RequestRateLimiter.rateLimitedRequests(requests, 2, 1000, options)
    .then(results => console.log('All results:', results))
    .catch(error => console.error('Callback error:', error));
```

### Geocoding Addresses And Saving Results In Batches

```javascript
import fs from 'fs';
import fetch from 'node-fetch';
import RequestRateLimiter from '@geoapify/request-rate-limiter';

const addresses = fs.readFileSync('addresses.txt', 'utf8').split('\n').filter(Boolean);

const GEOCODING_API_URL = 'https://api.geoapify.com/v1/geocode/search?limit=1&format=json';
const API_KEY = 'YOUR_API_KEY';

const createGeocodingRequest = (address) => {
    return async () => {
        const response = await fetch(`${GEOCODING_API_URL}&text=${encodeURIComponent(address)}&apiKey=${API_KEY}`);
        if (!response.ok) {
            return { address, error: `Failed to fetch for ${address}: ${response.statusText}` };
        }

        const data = await response.json();
        if (data.results.length) {
            return { address, result: data.results[0] };
        }

        return { address, error: 'Address is not found' };
    };
};

const requests = addresses.map(address => createGeocodingRequest(address));

const saveBatchResults = (batch) => {
    const filename = `geocode_results_batch_from_${batch.startIndex}_to_${batch.stopIndex}.json`;
    fs.writeFileSync(filename, JSON.stringify(batch.results, null, 2));
    console.log(`Batch from ${batch.startIndex} to ${batch.stopIndex} saved as ${filename}`);
};

RequestRateLimiter.rateLimitedRequests(requests, 5, 1000, {
    maxConcurrentRequests: 2,
    batchSize: 1000,
    onProgress: (progress) => {
        console.log(`Progress: ${progress.completedRequests}/${progress.totalRequests} completed`);
    },
    onBatchComplete: (batch) => {
        saveBatchResults(batch);
    }
})
    .then((allResults) => {
        fs.writeFileSync('geocode_results_all.json', JSON.stringify(allResults, null, 2));
        console.log('All requests completed.');
    })
    .catch(error => {
        console.error('Callback error:', error);
    });
```

## Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/geoapify/request-rate-limiter).

To run the project locally:

```bash
npm install
npm test
npm run build
```

## License

Licensed under the [MIT License](LICENSE).
