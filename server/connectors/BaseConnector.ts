import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { Store } from '@shared/schema';

// Standard interfaces for all connectors
export interface ConnectionResult {
  success: boolean;
  store_name?: string;
  domain?: string;
  products_count?: number;
  version?: string;
  error?: string;
  details?: any;
}

export interface ProductsResult {
  products: StandardProduct[];
  pagination: {
    current_page: number;
    total_pages?: number;
    total_items?: number;
    has_next?: boolean;
    // Cursor-based pagination support (for Shopify, etc.)
    next_cursor?: string;
    prev_cursor?: string;
  };
}

export interface ProductResult {
  product: StandardProduct;
}

export interface UpdateResult {
  success: boolean;
  product?: StandardProduct;
  error?: string;
  // Inventory update status (for platforms that support granular inventory control)
  inventory_status?: 'success' | 'partial_failure' | 'failed';
  inventory_message?: string;
}

export interface StoreInfoResult {
  name: string;
  domain: string;
  currency?: string;
  timezone?: string;
  version?: string;
  products_count?: number;
  raw_data?: any;
}

// Standardized product format across all platforms
export interface StandardProduct {
  id: string;
  name: string;
  sku?: string;
  price: number; // In cents to avoid decimal issues
  stock_quantity?: number;
  manage_stock: boolean;
  stock_status?: 'in_stock' | 'out_of_stock' | 'on_backorder';
  images?: string[];
  platform: string;
  raw_data?: any; // Full original product data
}

export interface StandardError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export interface RateLimitInfo {
  remaining: number;
  reset_time: number;
  limit: number;
}

/**
 * Base connector class that all platform connectors must extend
 * Provides common functionality and enforces a unified interface
 */
export abstract class BaseConnector {
  protected storeId: number;
  protected tenantId: number;
  protected credentials: any;
  protected baseUrl: string;
  protected platform: string;
  protected httpClient: AxiosInstance;
  protected rateLimitInfo: RateLimitInfo | null = null;

  constructor(store: Store) {
    this.storeId = store.id;
    this.tenantId = store.tenantId;
    this.credentials = store.apiCredentials;
    this.baseUrl = store.storeUrl;
    this.platform = store.platform;

    // Create configured HTTP client with common settings
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'G4Hub/1.0 (E-commerce Intelligence Platform)',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for logging and error handling
    this.setupInterceptors();
  }

  // Abstract methods that each platform must implement
  abstract testConnection(): Promise<ConnectionResult>;
  abstract getProducts(page?: number, limit?: number, pageInfo?: string): Promise<ProductsResult>;
  abstract getProduct(productId: string): Promise<ProductResult>;
  abstract updateProduct(productId: string, data: Partial<StandardProduct>): Promise<UpdateResult>;
  abstract getStoreInfo(): Promise<StoreInfoResult>;

  // Protected method for platform-specific request authentication
  protected abstract authenticateRequest(config: AxiosRequestConfig): AxiosRequestConfig;

  // Common utility methods available to all connectors
  protected async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig,
    retryCount: number = 0
  ): Promise<AxiosResponse> {
    try {
      const requestConfig: AxiosRequestConfig = {
        method,
        url: endpoint,
        data,
        headers: {}, // Normalize headers to avoid undefined
        ...config,
      };

      // Apply platform-specific authentication
      const authenticatedConfig = this.authenticateRequest(requestConfig);

      const response = await this.httpClient.request(authenticatedConfig);
      
      // Update rate limit info on successful response
      this.updateRateLimitInfo(response);
      
      return response;
    } catch (error: any) {
      // Update rate limit info on error responses too
      if (error.response) {
        this.updateRateLimitInfo(error.response);
      }

      // Handle retryable errors with exponential backoff
      if (this.shouldRetry(error, retryCount)) {
        const delay = this.calculateRetryDelay(retryCount, error);
        console.log(`[${this.platform}] Retrying request in ${delay}ms (attempt ${retryCount + 1}/3)`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(method, endpoint, data, config, retryCount + 1);
      }

      throw this.transformError(error);
    }
  }

  protected shouldRetry(error: any, retryCount: number): boolean {
    const maxRetries = 3;
    
    if (retryCount >= maxRetries) return false;
    
    // Retry on rate limiting
    if (error.response?.status === 429) return true;
    
    // Retry on transient server errors
    if (error.response?.status >= 500 && error.response?.status < 600) return true;
    
    // Retry on network errors (no response)
    if (!error.response && error.code !== 'ENOTFOUND') return true;
    
    return false;
  }

  protected calculateRetryDelay(retryCount: number, error: any): number {
    // Use Retry-After header if available (rate limiting)
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter) * 1000; // Convert to milliseconds
      }
    }
    
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, retryCount), 8000);
  }

  protected async handleRateLimit(error: any): Promise<void> {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
      
      console.log(`Rate limited. Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  protected transformError(error: any): StandardError {
    if (error.response) {
      // API error response
      return {
        message: error.response.data?.message || error.message || 'API request failed',
        code: error.response.data?.code || error.response.status.toString(),
        status: error.response.status,
        details: error.response.data,
      };
    } else if (error.request) {
      // Network error
      return {
        message: 'Network error - unable to connect to store',
        code: 'NETWORK_ERROR',
        details: error.message,
      };
    } else {
      // Other error
      return {
        message: error.message || 'Unknown error occurred',
        code: 'UNKNOWN_ERROR',
        details: error,
      };
    }
  }

  protected updateRateLimitInfo(response: AxiosResponse): void {
    const headers = response.headers;
    
    // Try platform-specific headers first, then fall back to common ones
    let remaining, limit, reset;

    // Shopify-specific headers
    if (this.platform === 'shopify') {
      const shopifyLimit = headers['x-shopify-shop-api-call-limit'];
      if (shopifyLimit) {
        const [used, total] = shopifyLimit.split('/').map(Number);
        remaining = total - used;
        limit = total;
      }
    }

    // WooCommerce/WordPress common headers
    if (!remaining && (this.platform === 'woocommerce' || this.platform === 'wordpress')) {
      remaining = headers['x-wp-ratelimit-remaining'];
      limit = headers['x-wp-ratelimit-limit'];
      reset = headers['x-wp-ratelimit-reset'];
    }

    // Contífico-specific headers (if they use standard format)
    if (!remaining && this.platform === 'contifico') {
      remaining = headers['x-api-calls-remaining'] || headers['x-ratelimit-remaining'];
      limit = headers['x-api-calls-limit'] || headers['x-ratelimit-limit'];
      reset = headers['x-api-calls-reset'] || headers['x-ratelimit-reset'];
    }

    // Fall back to common rate limit headers
    if (!remaining) {
      remaining = headers['x-rate-limit-remaining'] || headers['x-ratelimit-remaining'];
      limit = headers['x-rate-limit-limit'] || headers['x-ratelimit-limit'];
      reset = headers['x-rate-limit-reset'] || headers['x-ratelimit-reset'];
    }

    // Update rate limit info if we found valid data
    if (remaining !== undefined && limit !== undefined) {
      this.rateLimitInfo = {
        remaining: parseInt(remaining.toString()),
        limit: parseInt(limit.toString()),
        reset_time: reset ? parseInt(reset.toString()) : Date.now() + 3600000, // Default 1 hour
      };
      
      console.log(`[${this.platform}] Rate limit: ${this.rateLimitInfo.remaining}/${this.rateLimitInfo.limit} remaining`);
    }
  }

  protected setupInterceptors(): void {
    // Request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        console.log(`[${this.platform}] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error: any) => {
        console.error(`[${this.platform}] Request error:`, error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling and retries
    this.httpClient.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`[${this.platform}] ${response.status} ${response.config.url}`);
        return response;
      },
      async (error: any) => {
        console.error(`[${this.platform}] Response error:`, error.response?.status, error.message);
        
        // Handle rate limiting with retry
        if (error.response?.status === 429) {
          await this.handleRateLimit(error);
          // Optionally retry the request
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Utility method to validate required credentials
  protected validateCredentials(requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (!this.credentials[field]) {
        throw new Error(`Missing required credential: ${field}`);
      }
    }
  }

  // Get current rate limit status
  public getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  // Check if we're approaching rate limits
  public isApproachingRateLimit(threshold: number = 0.1): boolean {
    if (!this.rateLimitInfo) return false;
    
    const usageRatio = (this.rateLimitInfo.limit - this.rateLimitInfo.remaining) / this.rateLimitInfo.limit;
    return usageRatio > (1 - threshold);
  }
}