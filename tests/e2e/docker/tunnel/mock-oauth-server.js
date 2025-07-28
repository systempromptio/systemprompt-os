/**
 * Mock OAuth Provider Server for E2E Testing
 * 
 * This server simulates an OAuth2 provider (like Google or GitHub)
 * for testing the tunnel functionality with OAuth flows.
 */

const http = require('http');
const url = require('url');
const querystring = require('querystring');

const PORT = process.env.PORT || 4567;
const TUNNEL_CALLBACK_URL = process.env.TUNNEL_CALLBACK_URL || 'http://localhost:3000/oauth2/callback';

// Mock OAuth configuration
const mockConfig = {
  clientId: 'mock-client-id',
  clientSecret: 'mock-client-secret',
  authCodes: new Map(),
  accessTokens: new Map()
};

// Generate mock tokens
function generateToken() {
  return 'mock-' + Math.random().toString(36).substring(2, 15);
}

// Create server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health check endpoint
  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mock-oauth-provider' }));
    return;
  }
  
  // OAuth2 authorization endpoint
  if (pathname === '/oauth2/authorize' && req.method === 'GET') {
    const { client_id, redirect_uri, state, response_type } = parsedUrl.query;
    
    if (!client_id || !redirect_uri) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required parameters' }));
      return;
    }
    
    // Generate authorization code
    const authCode = generateToken();
    mockConfig.authCodes.set(authCode, {
      clientId: client_id,
      redirectUri: redirect_uri,
      createdAt: Date.now()
    });
    
    // Redirect back to callback URL with auth code
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set('code', authCode);
    if (state) {
      callbackUrl.searchParams.set('state', state);
    }
    
    res.writeHead(302, { 'Location': callbackUrl.toString() });
    res.end();
    return;
  }
  
  // OAuth2 token endpoint
  if (pathname === '/oauth2/token' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const params = querystring.parse(body);
      const { grant_type, code, client_id, client_secret, redirect_uri } = params;
      
      if (grant_type !== 'authorization_code') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unsupported_grant_type' }));
        return;
      }
      
      const authCodeData = mockConfig.authCodes.get(code);
      if (!authCodeData || authCodeData.clientId !== client_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      
      // Generate access token
      const accessToken = generateToken();
      const refreshToken = generateToken();
      
      mockConfig.accessTokens.set(accessToken, {
        clientId: client_id,
        scope: 'openid profile email',
        createdAt: Date.now()
      });
      
      // Clean up used auth code
      mockConfig.authCodes.delete(code);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: refreshToken,
        scope: 'openid profile email'
      }));
    });
    return;
  }
  
  // User info endpoint
  if (pathname === '/oauth2/userinfo' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    
    const token = authHeader.substring(7);
    if (!mockConfig.accessTokens.has(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_token' }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      sub: '123456789',
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/avatar.jpg'
    }));
    return;
  }
  
  // 404 for other endpoints
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, () => {
  console.log(`Mock OAuth provider listening on port ${PORT}`);
  console.log(`Tunnel callback URL: ${TUNNEL_CALLBACK_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down mock OAuth provider...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});