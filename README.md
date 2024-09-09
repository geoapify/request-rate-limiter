# request-rate-limiter

**A lightweight, zero-dependency Node.js library for managing and controlling API request rates with features like progress signaling and batch result retrieval**

The library designed to manage API request rates, prevent 429 "Too Many Requests" errors, and ensure compliance with rate limits for services like [Geocoding APIs](https://www.geoapify.com/geocoding-api/). It helps:

* **Prevent 429 Errors**: The library helps you avoid hitting rate limits that result in "Too Many Requests" (HTTP 429) errors by throttling the number of API calls made within a specific time interval.

* **Manage High Volumes of API Requests**: When handling large amounts of requests (e.g., Geocoding, weather, or payment APIs), the library ensures requests are executed in an orderly and rate-compliant manner.

* **Queue and Batch Requests**: It efficiently queues and batches requests that exceed rate limits, processing them when allowed by the server’s rate limit, so your application can avoid disruptions or delays.

* **Track Request Progress**: The library provides progress signaling and batch completion callbacks, allowing developers to monitor the status of API calls and handle results in manageable groups.

## Importing the Library
You can import the `@geoapify/request-rate-limiter` library into your project via Node.js or directly in the browser using a CDN.

### In Node.js

If you're using Node.js, install the library via npm:

```bash
npm install @geoapify/request-rate-limiter
```

Then, import it in your code:

#### ESM
For projects using ECMAScript Modules (ESM), you can import the library using the import syntax:
```javascript
import RequestRateLimiter from '@geoapify/request-rate-limiter';
```

#### CommonJS
If you are using the CommonJS module system (Node.js default), you can import the library like this:
```javascript
const RequestRateLimiter = require('@geoapify/request-rate-limiter');
```

## In HTML (Browser) using CDN
You can also use the library in the browser by loading it via a CDN:

Using unpkg:
```html
<script src="https://unpkg.com/@geoapify/request-rate-limiter"></script>
```

Using Cloudflare CDN:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/@geoapify/request-rate-limiter/latest/request-rate-limiter.min.js"></script>
```

## Usage
The library exposes a single core function: `RequestRateLimiter.rateLimitedRequests()`. This function allows you to control the rate at which a list of promise-based API requests is executed.

```javascript
RequestRateLimiter.rateLimitedRequests(requests, maxRequests, interval, options);
```

* **requests**: An array of functions that return promises (e.g., API requests) or another result.
* **maxRequests**: The maximum number of requests that can be executed within the specified interval.
* **interval**: The time interval (in milliseconds) within which the maxRequests are allowed.
* **options**: An optional object to provide additional configurations:
    * **batchSize** [optional]: Defines the size of batches for result retrieval. If set, results are returned in batches.
    * **onProgress** [optional]: A callback function to signal progress. Receives an object with `completedRequests` and `totalRequests`.
    * **onBatchComplete** [optional]: A callback function invoked when a batch is completed, providing batch results.

## Return Value

The function returns a promise that resolves once all requests have been processed. 

If the `batchSize` and `onBatchComplete` options are provided, additionally, batch results are returned as each batch is processed.

## Code samples
Here's an example of how to use the @geoapify/request-rate-limiter library to control API requests and see the results in batches:

### Example 1: Basic Usage with Logging
This example demonstrates a simple scenario where six functions are executed with rate limiting, batching, and progress logging.

```javascript
const RequestRateLimiter = require('@geoapify/request-rate-limiter');

const requests = [
    () => { console.log("One"); return 1; },
    () => { console.log("Two"); return 2; },
    () => { console.log("Three"); return 3; },
    () => { console.log("Four"); return 4; },
    () => { console.log("Five"); return 5; },
    () => { console.log("Six"); return 6; }
];

const options = {
    batchSize: 2, // Process two requests at a time
    onProgress: (progress) => console.log(`Progress: ${progress.completedRequests}/${progress.totalRequests} completed`),
    onBatchComplete: (batch) => console.log('Batch completed:', batch)
};

RequestRateLimiter.rateLimitedRequests(requests, 1, 1000, options)
  .then(results => console.log('All results:', results))
  .catch(error => console.error('Error processing requests:', error));
```

In this example, six functions (acting as mock API requests) are processed using the `@geoapify/request-rate-limiter` library. The requests are rate-limited to **one request every second** and are **grouped into batches of two**, as specified by batchSize: 2. 

Every time two requests are completed, the `onBatchComplete` callback is invoked, returning the results of those two processed requests. This setup allows for real-time tracking of progress and batch results, ensuring that requests are handled efficiently and within rate limits.

### Example2: Geocoding Addresses and Saving Results in Batches

This code sample demonstrates how to use the request-rate-limiter library to handle a large number of geocoding requests efficiently by reading a list of addresses from a file, sending them to the [Geoapify Geocoding API](https://www.geoapify.com/geocoding-api/), and saving the results in batches.

* It reads a list of addresses from a file and sends them to the Geoapify Geocoding API using `@geoapify/request-rate-limiter`. 
* It processes the requests in batches, with a maximum of 5 requests per second, and saves the results every 1000 requests into separate JSON files. 
* [Optionally] Once all requests are completed, the full results are saved in a final JSON file.


```javascript
import fs from 'fs';
import fetch from 'node-fetch';
import RequestRateLimiter  from '@geoapify/request-rate-limiter';

// Read addresses from a file
const addresses = fs.readFileSync('addresses.txt', 'utf8').split('\n').filter(address => !!address);

const GEOCODING_API_URL = 'https://api.geoapify.com/v1/geocode/search?limit=1&format=json';
const API_KEY = 'YOUR_API_KEY';

// Function to create geocoding requests
const createGeocodingRequest = (address) => {
    return async () => {
      const response = await fetch(`${GEOCODING_API_URL}&text=${encodeURIComponent(address)}&apiKey=${API_KEY}`);
      if (!response.ok) {
        return { address, error: `Failed to fetch for ${address}: ${response.statusText}`} 
      }
      const data = await response.json();

      if (data.results.length) {
        // get the first resilt
        return { address, result: data.results[0] };
      } else {
        return { address, error: `Address is not found` };
      }
    };
  };

// Prepare an array of request functions for the rate limiter
const requests = addresses.map((address) => createGeocodingRequest(address));

// Batch saving function
const saveBatchResults = (batch) => {
  const filename = `geocode_results_batch_from_${batch.startIndex}_to_${batch.stopIndex}.json`;
  fs.writeFileSync(filename, JSON.stringify(batch.results, null, 2));
  console.log(`Batch from ${batch.startIndex} to ${batch.stopIndex} saved as ${filename}`);
};

// Configure options for request-rate-limiter
const options = {
  batchSize: 1000, // Save results after every 1000 requests
  onProgress: (progress) => {
    console.log(`Progress: ${progress.completedRequests}/${progress.totalRequests} completed`);
  },
  onBatchComplete: (batch) => {
    console.log(`Batch of ${batch.results.length} requests completed.`);
    saveBatchResults(batch);
  }
};

// Use the request-rate-limiter to send API requests with rate limiting
RequestRateLimiter.rateLimitedRequests(requests, 5, 1000, options)
  .then((allResults) => {
    const filename = `geocode_results_all.json`;
    fs.writeFileSync(filename, JSON.stringify(allResults, null, 2));
    console.log('All requests completed.');
  })
  .catch(error => {
    console.error('Error processing requests:', error);
  });
```

With `@geoapify/request-rate-limiter`, you can efficiently handle high volumes of API requests while staying within rate limits. This ensures reliable performance, prevents overloading your API services, and provides useful features like progress tracking and batch processing for easier data management. Whether you're working with Geocoding APIs or other rate-limited services, this library offers a flexible and lightweight solution for smooth request handling.