import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../dist/src/server/index.js';
import { resetModuleLoader } from '../../dist/src/core/modules/loader.js';

describe('Server Startup Integration', () => {
  beforeEach(() => {
    // Reset module loader to avoid registration conflicts
    resetModuleLoader();
  });

  it('should create the app successfully', async () => {
    const app = await createApp();
    expect(app).toBeDefined();
    expect(app.listen).toBeDefined();
  });

  it('should respond to health endpoint', async () => {
    const app = await createApp();
    
    const response = await request(app)
      .get('/health')
      .expect(200);
      
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('system');
    expect(response.body.system).toHaveProperty('uptime');
  });

  it('should respond to status endpoint', async () => {
    const app = await createApp();
    
    const response = await request(app)
      .get('/status')
      .expect(200);
      
    expect(response.body).toHaveProperty('servers');
    expect(response.body).toHaveProperty('providers');
  });

  it('should serve OpenID configuration', async () => {
    const app = await createApp();
    
    const response = await request(app)
      .get('/.well-known/openid-configuration')
      .expect(200);
      
    expect(response.body).toHaveProperty('issuer');
    expect(response.body).toHaveProperty('authorization_endpoint');
    expect(response.body).toHaveProperty('token_endpoint');
    expect(response.body).toHaveProperty('userinfo_endpoint');
  });
});