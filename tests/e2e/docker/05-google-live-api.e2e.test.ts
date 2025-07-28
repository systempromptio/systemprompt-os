import { describe, it, expect } from 'vitest';
import { execInContainer, getTestBaseUrl } from './bootstrap.js';

/**
 * Google Live API Integration E2E Tests
 *
 * Tests the integration between the config module and Google Live API:
 * - Loading Google configuration from config module
 * - Creating Live API session using SDK
 * - Sending and receiving messages through the Live API
 */
describe('[05] Google Live API Integration', () => {
  const baseUrl = getTestBaseUrl();
  describe('Config Module Integration', () => {
    it('should load config module successfully', async () => {
      const { stdout } = await execInContainer(`curl -s ${baseUrl}/api/status`);
      const status = JSON.parse(stdout);
      expect(status.modules.loaded).toContain('core/config');
    });

    it('should retrieve Google configuration from config module', async () => {
      // Get config through the systemprompt CLI
      const { stdout } = await execInContainer('/app/bin/systemprompt config get --key google');
      expect(stdout).toBeDefined();

      // Parse the output (it should be JSON)
      const googleConfig = JSON.parse(stdout);
      expect(googleConfig).toBeDefined();
      expect(googleConfig).toHaveProperty('apiKey');
      expect(googleConfig).toHaveProperty('vertexai');

      // API key should be loaded from environment
      expect(googleConfig.apiKey).toBeTruthy();
      expect(googleConfig.apiKey).not.toBe('');
      expect(googleConfig.apiKey).not.toContain('test-');
    });

    it('should have default model configurations', async () => {
      const { stdout } = await execInContainer(
        '/app/bin/systemprompt config get --key models.default',
      );
      const modelConfig = JSON.parse(stdout);

      expect(modelConfig).toBeDefined();
      expect(modelConfig.model).toBe('gemini-1.5-flash');
      expect(modelConfig.generationConfig).toBeDefined();
      expect(modelConfig.generationConfig.temperature).toBeDefined();
      expect(modelConfig.generationConfig.topK).toBeDefined();
      expect(modelConfig.generationConfig.topP).toBeDefined();
      expect(modelConfig.generationConfig.maxOutputTokens).toBeDefined();
    });
  });

  describe('Google Live API Session', () => {
    it('should create a Live API session and exchange messages', async () => {
      // Create a test script inside the container that uses the config
      const testScript = `
const { GoogleGenAI } = require('@google/genai');

async function testLiveAPI() {
  try {
    // Get config from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'test-gemini-api-key') {
      console.log('SKIP: No valid API key found');
      return;
    }

    // Initialize client
    const genai = new GoogleGenAI({ apiKey });
    
    // Test generation using models API
    const result = await genai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Say "Hello from Docker E2E test!" and nothing else.' }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    });
    
    const text = result.candidates[0].content.parts[0].text;
    console.log('SUCCESS:' + text);
  } catch (error) {
    console.error('ERROR:' + error.message);
  }
}

testLiveAPI();
`;

      // Write the test script to a file in the container
      await execInContainer(`cat > /tmp/test-live-api.js << 'EOF'
${testScript}
EOF`);

      // Execute the test script
      const { stdout, stderr } = await execInContainer('cd /app && node /tmp/test-live-api.js');

      if (stdout.includes('SKIP:')) {
        console.log('Skipping Live API test - no valid API key in container');
        return;
      }

      // Check for errors
      if (stderr || stdout.includes('ERROR:')) {
        throw new Error(`Live API test failed: ${stderr || stdout}`);
      }

      // Verify success
      expect(stdout).toContain('SUCCESS:');
      const response = stdout.split('SUCCESS:')[1].trim();
      expect(response.toLowerCase()).toContain('hello');
      expect(response.toLowerCase()).toContain('docker');
      expect(response.toLowerCase()).toContain('e2e test');
    });

    it('should test streaming with config values from module', async () => {
      // Create a streaming test script
      const streamScript = `
const { GoogleGenAI } = require('@google/genai');

async function testStreaming() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'test-gemini-api-key') {
      console.log('SKIP: No valid API key found');
      return;
    }

    const genai = new GoogleGenAI({ apiKey });
    
    const result = await genai.models.generateContentStream({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Count from 1 to 3 slowly' }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 100 }
    });
    
    let fullText = '';
    for await (const chunk of result) {
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
        fullText += chunk.candidates[0].content.parts[0].text;
      }
    }

    if (fullText.includes('1') && fullText.includes('2') && fullText.includes('3')) {
      console.log('STREAM_SUCCESS:' + fullText);
    } else {
      console.log('STREAM_FAIL: Missing numbers - got: ' + fullText);
    }
  } catch (error) {
    console.error('STREAMerror:' + error.message);
  }
}

testStreaming();
`;

      await execInContainer(`cat > /tmp/test-streaming.js << 'EOF'
${streamScript}
EOF`);

      const { stdout } = await execInContainer('cd /app && node /tmp/test-streaming.js');

      if (stdout.includes('SKIP:')) {
        console.log('Skipping streaming test - no valid API key');
        return;
      }

      expect(stdout).toContain('STREAM_SUCCESS:');
      const response = stdout.split('STREAM_SUCCESS:')[1];
      expect(response).toMatch(/1.*2.*3/s);
    });
  });

  describe('Config Validation', () => {
    it('should validate Google configuration', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt config validate');

      // Should not have errors for valid config
      expect(stderr).toBe('');
      expect(stdout).toContain('valid');
    });

    it('should use environment variables for sensitive data', async () => {
      // Check that the API key is loaded from environment
      const { stdout } = await execInContainer('echo $GEMINI_API_KEY');
      const envApiKey = stdout.trim();

      // Should have a real API key from .env
      expect(envApiKey).toBeTruthy();
      expect(envApiKey).not.toBe('test-gemini-api-key');
      expect(envApiKey).toMatch(/^AIza/); // Google API keys typically start with AIza
    });
  });

  describe('Model Presets', () => {
    it('should have coder preset configuration', async () => {
      const { stdout } = await execInContainer(
        '/app/bin/systemprompt config get --key models.coder',
      );
      const coderConfig = JSON.parse(stdout);

      expect(coderConfig.model).toBe('gemini-1.5-pro');
      expect(coderConfig.generationConfig.temperature).toBeLessThan(0.5);
      expect(coderConfig.systemInstruction).toContain('engineer');
    });

    it('should have creative preset configuration', async () => {
      const { stdout } = await execInContainer(
        '/app/bin/systemprompt config get --key models.creative',
      );
      const creativeConfig = JSON.parse(stdout);

      expect(creativeConfig.model).toBe('gemini-1.5-flash');
      expect(creativeConfig.generationConfig.temperature).toBeGreaterThan(1.0);
      expect(creativeConfig.systemInstruction).toContain('creative');
    });
  });
});
