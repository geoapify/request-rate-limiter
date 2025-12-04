/**
 * Geocoding API Example with TypeScript - Request Rate Limiter
 * 
 * This example shows how to use the rate limiter with Geoapify Geocoding API
 * with full TypeScript type safety.
 */

import { rateLimitedRequests, Options, ProgressData, BatchResult } from '../../dist/request-rate-limiter';
import https from 'https';

// Replace with your Geoapify API key
const API_KEY = 'YOUR_API_KEY_HERE';

// Define types for geocoding results
interface GeocodingResult {
    address: string;
    formatted?: string;
    lat?: number;
    lon?: number;
    error?: string;
}

interface GeoapifyResponse {
    results: Array<{
        formatted: string;
        lat: number;
        lon: number;
    }>;
}

// Sample addresses to geocode
const addresses: string[] = [
    '1600 Amphitheatre Parkway, Mountain View, CA',
    '1 Apple Park Way, Cupertino, CA',
    '1 Microsoft Way, Redmond, WA',
    '410 Terry Avenue North, Seattle, WA',
    '1355 Market Street, San Francisco, CA'
];

// Function to geocode a single address with proper typing
function geocodeAddress(address: string): Promise<GeocodingResult> {
    return new Promise((resolve, reject) => {
        const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${API_KEY}&format=json`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk: Buffer) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result: GeoapifyResponse = JSON.parse(data);
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

// Configure typed options
const options: Options<GeocodingResult> = {
    batchSize: 2,
    onProgress: (progress: ProgressData) => {
        console.log(`📍 Geocoded: ${progress.completedRequests}/${progress.totalRequests} addresses`);
    },
    onBatchComplete: (batch: BatchResult<GeocodingResult>) => {
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

async function runGeocodingDemo(): Promise<void> {
    console.log('🌍 Geoapify Geocoding API Example with TypeScript\n');
    console.log('Rate limiting: 3 requests per second');
    console.log(`Geocoding ${addresses.length} addresses...\n`);

    // @ts-ignore
    if (API_KEY === 'YOUR_API_KEY_HERE') {
        console.error('❌ Please set your Geoapify API key in the script!');
        console.log('Get your free API key at: https://www.geoapify.com/');
        process.exit(1);
    }

    try {
        // Create typed request functions
        const requests = addresses.map(address => () => geocodeAddress(address));

        // results is typed as GeocodingResult[]
        const results: GeocodingResult[] = await rateLimitedRequests<GeocodingResult>(
            requests,
            3,
            1000,
            options
        );

        console.log(`\n🎉 Geocoding complete!`);
        const successCount = results.filter(r => !r.error).length;
        console.log(`Successfully geocoded ${successCount}/${results.length} addresses`);

        // TypeScript knows the structure
        results.forEach(result => {
            if (!result.error && result.lat && result.lon) {
                console.log(`${result.address} → [${result.lat}, ${result.lon}]`);
            }
        });
    } catch (error) {
        console.error('❌ Error:', (error as Error).message);
    }
}

runGeocodingDemo();

