const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('pawn_repo_token');
    this.refreshToken = localStorage.getItem('pawn_repo_refresh_token');
    this.lastVerifyCall = 0;
    this.verifyThrottleMs = 30000; // Only allow verify calls every 30 seconds
    
    // EMERGENCY: Rate limit protection
    this.requestQueue = new Map(); // Track ongoing requests
    this.requestCache = new Map(); // Cache recent responses
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // Minimum 100ms between requests
    this.rateLimitRetryDelay = 2000; // 2 second delay for rate limit retries
    this.cacheExpiry = 30000; // 30 second cache for GET requests to reduce API calls
  }

  async login(userCredentials) {
    try {
      // Use login-with-refresh endpoint for proper token management
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/jwt/login-with-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userCredentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      
      if (data.access_token) {
        localStorage.setItem('pawn_repo_token', data.access_token);
        this.token = data.access_token;
      }
      
      if (data.refresh_token) {
        localStorage.setItem('pawn_repo_refresh_token', data.refresh_token);
        this.refreshToken = data.refresh_token;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/jwt/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.refreshToken
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Refresh token expired, clear everything and force re-login
          this.logout();
          // Force page reload to redirect to login
          window.location.reload();
        }
        return false;
      }

      const data = await response.json();
      
      if (data.access_token) {
        localStorage.setItem('pawn_repo_token', data.access_token);
        this.token = data.access_token;
      }
      
      // Backend only returns new access token, refresh token stays the same
      if (data.refresh_token) {
        localStorage.setItem('pawn_repo_refresh_token', data.refresh_token);
        this.refreshToken = data.refresh_token;
      }

      return true;
    } catch (error) {
      // On network error, don't clear tokens - user might be temporarily offline
      return false;
    }
  }

  isTokenExpiringSoon(token) {
    try {
      // Decode JWT token to check expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      // Consider token expiring soon if less than 5 minutes left
      return timeUntilExpiry < 5 * 60 * 1000;
    } catch (error) {
      // If we can't decode the token, assume it needs refresh
      return true;
    }
  }

  isTokenExpired(token) {
    try {
      // Decode JWT token to check expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      
      // Token is expired if current time is past expiry time
      return currentTime >= expiryTime;
    } catch (error) {
      // If we can't decode the token, assume it's invalid/expired
      return true;
    }
  }

  async verifyToken() {
    if (!this.token) return false;

    // Throttle verify calls to prevent rate limiting
    const now = Date.now();
    if (now - this.lastVerifyCall < this.verifyThrottleMs) {
      // Skip verification if called recently - assume token is still valid
      return true;
    }

    // Check if token is expiring soon and proactively refresh
    if (this.refreshToken && this.isTokenExpiringSoon(this.token)) {
      const refreshSuccess = await this.refreshAccessToken();
      if (refreshSuccess) {
        return true;
      }
    }

    try {
      // Update timestamp before making the call
      this.lastVerifyCall = now;
      
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/jwt/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return true;
      }

      // If token verification fails, try to refresh if we have a refresh token
      if (response.status === 422 || response.status === 401) {
        if (this.refreshToken) {
          const refreshSuccess = await this.refreshAccessToken();
          if (refreshSuccess) {
            return true;
          }
        } else {
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  async getCurrentUser() {
    if (!this.token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/user/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      return await response.json();
    } catch (error) {
      return null;
    }
  }

  logout() {
    localStorage.removeItem('pawn_repo_token');
    localStorage.removeItem('pawn_repo_refresh_token');
    this.token = null;
    this.refreshToken = null;
    // Clear caches on logout
    this.clearCache();
  }
  
  // EMERGENCY: Cache management utilities
  clearCache(pattern = null) {
    if (pattern) {
      // Clear specific cache entries matching pattern
      for (const key of this.requestCache.keys()) {
        if (key.includes(pattern)) {
          this.requestCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.requestCache.clear();
    }
  }
  
  // Force immediate cache invalidation for data modification operations
  invalidateDataCache() {
    // Clear all customer-related cache entries immediately
    this.clearCache('/api/v1/customer');
    this.clearCache('/api/v1/user');
  }
  
  getCacheStats() {
    return {
      cacheSize: this.requestCache.size,
      queueSize: this.requestQueue.size,
      cacheExpiry: this.cacheExpiry,
      minRequestInterval: this.minRequestInterval
    };
  }

  isAuthenticated() {
    return !!this.token;
  }

  getToken() {
    return this.token;
  }

  // EMERGENCY: Enhanced API request method with rate limiting and caching
  async apiRequest(endpoint, options = {}) {
    const method = options.method || 'GET';
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(options.body || {})}`;
    
    // Check cache for GET requests
    if (method === 'GET' && this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      } else {
        this.requestCache.delete(cacheKey);
      }
    }
    
    // Check if identical request is already in progress
    if (this.requestQueue.has(cacheKey)) {
      return await this.requestQueue.get(cacheKey);
    }
    
    // Rate limiting - ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
    
    // Create the request promise
    const requestPromise = this.executeApiRequest(endpoint, options, cacheKey);
    
    // Store in queue to prevent duplicates
    this.requestQueue.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Remove from queue when done
      this.requestQueue.delete(cacheKey);
    }
  }
  
  async executeApiRequest(endpoint, options, cacheKey) {
    const method = options.method || 'GET';
    
    // Proactively refresh token if it's expiring soon
    if (this.token && this.refreshToken && this.isTokenExpiringSoon(this.token)) {
      await this.refreshAccessToken();
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    let response = await fetch(url, config);
    
    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.rateLimitRetryDelay;
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the request once
      response = await fetch(url, config);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      }
    }
    
    // If we get a 401/422 (token expired), try to refresh and retry once
    if ((response.status === 401 || response.status === 422) && this.refreshToken) {
      const refreshSuccess = await this.refreshAccessToken();
      
      if (refreshSuccess) {
        config.headers.Authorization = `Bearer ${this.token}`;
        response = await fetch(url, config);
      } else {
        throw new Error('Authentication failed - please login again');
      }
    } else if ((response.status === 401 || response.status === 422) && !this.refreshToken) {
      this.logout();
      window.location.reload();
      throw new Error('Authentication failed - please login again');
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Cache GET requests only if not a data modification response
    if (method === 'GET') {
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
    } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      // For data modification, immediately invalidate related cache
      this.invalidateDataCache();
    }
    
    return data;
  }
}

const authService = new AuthService();
export default authService;