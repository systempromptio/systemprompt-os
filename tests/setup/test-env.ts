// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_ISSUER = 'test-issuer';
process.env.JWT_AUDIENCE = 'test-audience';
process.env.PORT = '0'; // Use random port for tests

// Suppress console output during tests unless DEBUG_TESTS is set
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}