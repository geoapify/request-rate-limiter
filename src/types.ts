/**
 * A function that returns a value or a promise of a value
 */
export type RequestFunction<T = any> = () => T | Promise<T>;

/**
 * A successful request value or the Error captured from a failed request
 */
export type RequestResult<T = any> = T | Error;

/**
 * Progress information for tracking request completion
 */
export interface ProgressData {
  /** Total number of requests to be executed */
  totalRequests: number;
  /** Number of requests completed so far */
  completedRequests: number;
}

/**
 * Batch result containing completed request results
 */
export interface BatchResult<T> {
  /** Starting index of this batch (inclusive) */
  startIndex: number;
  /** Ending index of this batch (inclusive) */
  stopIndex: number;
  /** Array of results from the batch */
  results: RequestResult<T>[];
}

/**
 * Options for configuring rate-limited request execution
 */
export interface Options<T = any> {
  /**
   * Maximum number of requests that may run at the same time.
   * Defaults to maxRequests.
   */
  maxConcurrentRequests?: number;
  /** 
   * Size of batches for result retrieval. 
   * If set, results are returned in batches via onBatchComplete callback 
   */
  batchSize?: number;
  /** 
   * Callback function to signal progress. 
   * Receives an object with completedRequests and totalRequests 
   */
  onProgress?: (progress: ProgressData) => void;
  /** 
   * Callback function invoked when a batch is completed.
   * Provides batch results including startIndex, stopIndex, and results array 
   */
  onBatchComplete?: (batch: BatchResult<T>) => void;
}

/**
 * Internal state for tracking batch execution
 * @internal
 */
export interface BatchState<T = any> {
  batchItemsToFire: RequestResult<T>[];
  batchItemsReady: boolean[];
  totalRequests: number;
  completedRequests: number;
}
