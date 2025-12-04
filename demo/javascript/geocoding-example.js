/**
 * Geocoding API Example - Request Rate Limiter
 * 
 * This example shows how to use the rate limiter with Geoapify Geocoding API
 * to geocode multiple addresses while respecting rate limits.
 */

const { rateLimitedRequests } = require('../../dist/request-rate-limiter');
const https = require('https');

// Replace with your Geoapify API key
const API_KEY = 'YOUR_API_KEY_HERE';

// Sample addresses to geocode
const addresses = [
    '1600 Amphitheatre Parkway, Mountain View, CA',
    '1 Apple Park Way, Cupertino, CA',
    '1 Microsoft Way, Redmond, WA',
    '410 Terry Avenue North, Seattle, WA',
    '1355 Market Street, San Francisco, CA'
];

// Function to geocode a single address
function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
        const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${API_KEY}&format=json`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.results && result.results.length > 0) {
                        const location = result.results[0];
                        resolve({
                            address: address,
                            formatted: location.formatted,
                            lat: location.lat,
                            lon: location.lon
                        });
                    } else {
                        resolve({ address: address, error: 'Not found' });
                    }
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

// Create request functions
const requests = addresses.map(address => () => geocodeAddress(address));

// Configure options
const options = {
    batchSize: 2,
    onProgress: (progress) => {
        console.log(`📍 Geocoded: ${progress.completedRequests}/${progress.totalRequests} addresses`);
    },
    onBatchComplete: (batch) => {
        console.log(`\n✅ Batch ${Math.floor(batch.startIndex / 2) + 1} completed:`);
        batch.results.forEach(result => {
            if (result.error) {
                console.log(`   ❌ ${result.address}: ${result.error}`);
            } else {
                console.log(`   ✓ ${result.formatted}`);
                console.log(`     Coordinates: ${result.lat}, ${result.lon}`);
            }
        });
    }
};

console.log('🌍 Geoapify Geocoding API Example\n');
console.log('Rate limiting: 3 requests per second');
console.log(`Geocoding ${addresses.length} addresses...\n`);

if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('❌ Please set your Geoapify API key in the script!');
    console.log('Get your free API key at: https://www.geoapify.com/');
    process.exit(1);
}

rateLimitedRequests(requests, 3, 1000, options)
    .then(results => {
        console.log(`\n🎉 Geocoding complete!`);
        console.log(`Successfully geocoded ${results.filter(r => !r.error).length}/${results.length} addresses`);
        
        // Display all results
        results.forEach(result => {
            if (!result.error && result.lat && result.lon) {
                console.log(`${result.address} → [${result.lat}, ${result.lon}]`);
            }
        });
    })
    .catch(error => {
        console.error('❌ Error:', error.message);
    });

