import request from 'supertest';

const baseUrl = 'http://localhost:3001';

async function runAuthTests() {
  console.log('🧪 Running Auth E2E Tests');
  console.log('📍 Base URL:', baseUrl);
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  async function test(name, fn) {
    results.total++;
    console.log(`\n▶️  Testing: ${name}`);
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'passed' });
      console.log('✅ PASSED');
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: 'failed', error: error.message });
      console.log('❌ FAILED:', error.message);
    }
  }

  // Test 1: OAuth 2.1 authorization server metadata
  await test('should provide OAuth 2.1 authorization server metadata', async () => {
    const response = await request(baseUrl).get('/.well-known/oauth-authorization-server');
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    // Check issuer - this should now be http://localhost:3001
    if (response.body.issuer !== baseUrl) {
      throw new Error(`Expected issuer "${baseUrl}", got "${response.body.issuer}"`);
    }
    
    // Check required endpoints
    const requiredEndpoints = [
      'authorization_endpoint',
      'token_endpoint', 
      'userinfo_endpoint',
      'jwks_uri'
    ];
    
    for (const endpoint of requiredEndpoints) {
      if (!response.body[endpoint]) {
        throw new Error(`Missing required endpoint: ${endpoint}`);
      }
    }
  });

  // Test 2: JWKS endpoint
  await test('should provide JWKS endpoint', async () => {
    const response = await request(baseUrl).get('/.well-known/jwks.json');
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.body.keys || !Array.isArray(response.body.keys)) {
      throw new Error('JWKS response should have keys array');
    }
    
    if (response.body.keys.length === 0) {
      throw new Error('JWKS keys array should not be empty');
    }
    
    const key = response.body.keys[0];
    const requiredKeyFields = ['kty', 'use', 'kid', 'alg'];
    
    for (const field of requiredKeyFields) {
      if (!key[field]) {
        throw new Error(`JWKS key missing required field: ${field}`);
      }
    }
  });

  // Test 3: Authorization request validation
  await test('should reject authorization request without client_id', async () => {
    const response = await request(baseUrl)
      .get('/oauth2/authorize')
      .query({
        response_type: 'code',
        redirect_uri: 'http://localhost:8080/callback',
        state: 'test-state'
      });
    
    if (response.status !== 400) {
      throw new Error(`Expected status 400, got ${response.status}`);
    }
    
    if (response.body.error !== 'invalid_request') {
      throw new Error(`Expected error "invalid_request", got "${response.body.error}"`);
    }
  });

  // Test 4: Token endpoint validation
  await test('should reject token request without grant_type', async () => {
    const response = await request(baseUrl)
      .post('/oauth2/token')
      .send({
        code: 'test-code',
        client_id: 'test-client',
        client_secret: 'test-secret'
      });
    
    if (response.status !== 400) {
      throw new Error(`Expected status 400, got ${response.status}`);
    }
    
    if (response.body.error !== 'invalid_request') {
      throw new Error(`Expected error "invalid_request", got "${response.body.error}"`);
    }
  });

  // Test 5: Protected endpoint validation
  await test('should reject userinfo request without token', async () => {
    const response = await request(baseUrl).get('/oauth2/userinfo');
    
    if (response.status !== 401) {
      throw new Error(`Expected status 401, got ${response.status}`);
    }
    
    if (response.body.error !== 'invalid_token') {
      throw new Error(`Expected error "invalid_token", got "${response.body.error}"`);
    }
  });

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(50));

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests.filter(t => t.status === 'failed').forEach(t => {
      console.log(`  ❌ ${t.name}`);
      console.log(`     ${t.error}`);
    });
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

runAuthTests().catch(console.error);