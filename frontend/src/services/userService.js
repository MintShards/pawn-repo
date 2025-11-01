import { getTimezoneHeaders } from '../utils/timezoneUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class UserService {
  constructor() {
    this.requestCache = new Map();
    this.cacheExpiry = 30000; // 30 second cache
  }

  /**
   * Get authorization headers with JWT token
   */
  getAuthHeaders() {
    const token = sessionStorage.getItem('pawn_repo_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...getTimezoneHeaders(),
    };
  }

  /**
   * Handle API responses
   */
  async handleResponse(response) {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorData = await response.json();

        // Check multiple possible fields for the error message
        // Check nested details.message first (most specific error)
        errorMessage = (errorData.details && errorData.details.message) ||
                      // Check validation_errors array (Pydantic validation errors)
                      (errorData.details && errorData.details.validation_errors &&
                       errorData.details.validation_errors[0]?.message) ||
                      errorData.detail ||
                      errorData.message ||
                      errorData.error ||
                      errorData.error_message ||
                      (errorData.validation_error && errorData.validation_error[0]?.msg) ||
                      errorMessage;
      } catch (parseError) {
        // If JSON parsing fails, try to get text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch (textError) {
          // Silent failure - use default HTTP status message
        }
      }

      throw new Error(errorMessage);
    }
    return response.json();
  }

  /**
   * Get list of users with filtering and pagination
   */
  async getUsersList(filters = {}) {
    const queryParams = new URLSearchParams();

    if (filters.role) queryParams.append('role', filters.role);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.per_page) queryParams.append('per_page', filters.per_page);
    if (filters.sort_by) queryParams.append('sort_by', filters.sort_by);
    if (filters.sort_order) queryParams.append('sort_order', filters.sort_order);

    const cacheKey = `users_list_${queryParams.toString()}`;

    // Check cache
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/user/list?${queryParams}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await this.handleResponse(response);

    // Cache the result
    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    const cacheKey = 'user_stats';

    // Check cache
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/user/stats`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await this.handleResponse(response);

    // Cache the result
    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/${userId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Create a new user (Admin only)
   */
  async createUser(userData) {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/create`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData),
    });

    const data = await this.handleResponse(response);

    // Clear cache
    this.clearCache();

    return data;
  }

  /**
   * Update user information
   */
  async updateUser(userId, updateData) {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/${userId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    const data = await this.handleResponse(response);

    // Clear cache
    this.clearCache();

    return data;
  }

  /**
   * Deactivate user (Admin only)
   */
  async deactivateUser(userId) {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/${userId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    const data = await this.handleResponse(response);

    // Clear cache
    this.clearCache();

    return data;
  }

  /**
   * Reset user PIN (Admin only)
   */
  async resetUserPin(userId) {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/${userId}/reset-pin`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    const data = await this.handleResponse(response);

    return data;
  }

  /**
   * Set user PIN to a specific value (Admin only)
   */
  async setUserPin(userId, newPin) {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/${userId}/set-pin`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ new_pin: newPin }),
    });

    const data = await this.handleResponse(response);

    return data;
  }

  /**
   * Unlock user account (Admin only)
   */
  async unlockUser(userId) {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/${userId}/unlock`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    const data = await this.handleResponse(response);

    // Clear cache
    this.clearCache();

    return data;
  }

  /**
   * Get user active sessions (Admin only)
   */
  async getUserSessions(userId) {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/${userId}/sessions`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Terminate all user sessions (Admin only)
   */
  async terminateUserSessions(userId) {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/${userId}/sessions`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.requestCache.clear();
  }
}

const userServiceInstance = new UserService();
export default userServiceInstance;
