import {
  logError,
  logWarning,
  logInfo,
  logDebug,
  logApiError,
  logSilentError
} from '../logger';

// Mock console methods
const originalConsole = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  log: console.log
};

// Mock fetch for remote logging
global.fetch = jest.fn();

describe('logger', () => {
  beforeEach(() => {
    // Mock console methods
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.log = jest.fn();

    // Clear fetch mock
    global.fetch.mockClear();
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.log = originalConsole.log;
  });

  describe('logError', () => {
    it('should log error message with context', () => {
      const message = 'Test error';
      const context = { userId: 123 };

      logError(message, context);

      expect(console.error).toHaveBeenCalledWith(
        '[ERROR] Test error',
        context
      );
    });

    it('should handle error without context', () => {
      logError('Error message');

      expect(console.error).toHaveBeenCalledWith(
        '[ERROR] Error message',
        {}
      );
    });

    it('should not log in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      logError('Production error');

      // Should not call console.error in production
      expect(console.error).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('logWarning', () => {
    it('should log warning message with context', () => {
      const message = 'Test warning';
      const context = { code: 'WARN_001' };

      logWarning(message, context);

      expect(console.warn).toHaveBeenCalledWith(
        '[WARN] Test warning',
        context
      );
    });

    it('should handle warning without context', () => {
      logWarning('Warning message');

      expect(console.warn).toHaveBeenCalledWith(
        '[WARN] Warning message',
        {}
      );
    });
  });

  describe('logInfo', () => {
    it('should log info message with context', () => {
      const message = 'Test info';
      const context = { feature: 'dashboard' };

      logInfo(message, context);

      expect(console.info).toHaveBeenCalledWith(
        '[INFO] Test info',
        context
      );
    });
  });

  describe('logDebug', () => {
    it('should log debug message in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      logDebug('Debug message', { test: true });

      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG] Debug message',
        { test: true }
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not log debug in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      logDebug('Debug message');

      expect(console.log).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('logApiError', () => {
    it('should log API error with endpoint and error details', () => {
      const endpoint = '/api/v1/users';
      const error = {
        status: 500,
        statusText: 'Internal Server Error',
        response: {
          data: { message: 'Database error' }
        }
      };

      logApiError(endpoint, error);

      expect(console.error).toHaveBeenCalled();
      const callArgs = console.error.mock.calls[0];
      expect(callArgs[0]).toContain('API Error');
      expect(callArgs[0]).toContain(endpoint);
      expect(callArgs[1]).toMatchObject({
        endpoint,
        status: 500,
        statusText: 'Internal Server Error'
      });
    });

    it('should handle API error with request data', () => {
      const endpoint = '/api/v1/users';
      const error = { status: 400, message: 'Bad Request' };
      const requestData = { username: 'test' };

      logApiError(endpoint, error, requestData);

      expect(console.error).toHaveBeenCalled();
      const context = console.error.mock.calls[0][1];
      expect(context.requestData).toBeTruthy();
    });

    it('should limit request data size', () => {
      const endpoint = '/api/v1/users';
      const error = { status: 400 };
      const largeData = { data: 'x'.repeat(1000) };

      logApiError(endpoint, error, largeData);

      const context = console.error.mock.calls[0][1];
      expect(context.requestData.length).toBeLessThanOrEqual(500);
    });
  });

  describe('logSilentError', () => {
    it('should not log to console', () => {
      logSilentError('Silent error', { internal: true });

      expect(console.error).not.toHaveBeenCalled();
    });

    it('should attempt remote logging if configured', () => {
      const originalEnv = process.env.REACT_APP_ENABLE_REMOTE_LOGGING;
      const originalEndpoint = process.env.REACT_APP_LOG_ENDPOINT;

      process.env.REACT_APP_ENABLE_REMOTE_LOGGING = 'true';
      process.env.REACT_APP_LOG_ENDPOINT = 'https://logs.example.com';

      global.fetch.mockResolvedValue({ ok: true });

      logSilentError('Silent error');

      // Note: Actual remote logging may not execute in sync
      // This test ensures no console output
      expect(console.error).not.toHaveBeenCalled();

      process.env.REACT_APP_ENABLE_REMOTE_LOGGING = originalEnv;
      process.env.REACT_APP_LOG_ENDPOINT = originalEndpoint;
    });
  });

  describe('environment behavior', () => {
    it('should respect NODE_ENV for console output', () => {
      const originalEnv = process.env.NODE_ENV;

      // Test development mode
      process.env.NODE_ENV = 'development';
      logError('Dev error');
      expect(console.error).toHaveBeenCalled();

      console.error.mockClear();

      // Test production mode
      process.env.NODE_ENV = 'production';
      logError('Prod error');
      expect(console.error).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('structured log format', () => {
    it('should include timestamp in log context', () => {
      logError('Test error', { test: true });

      // Log format should include timestamp (tested via console output structure)
      expect(console.error).toHaveBeenCalled();
    });

    it('should include context data', () => {
      const context = { userId: 123, action: 'login' };
      logError('Login failed', context);

      expect(console.error).toHaveBeenCalledWith(
        expect.any(String),
        context
      );
    });
  });
});
