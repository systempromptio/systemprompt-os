#!/usr/bin/env node
/**
 * Manual test to verify Google config is loaded correctly
 * Usage: npx tsx tests/manual/test-google-config.ts [message]
 * Example: npx tsx tests/manual/test-google-config.ts "What is 2+2?"
 */

import { ConfigModule } from '../../src/modules/core/config/index.js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { parse } from 'yaml';

// Load environment variables
config();

async function testGoogleConfig() {
  console.log('Testing Google Config Module...\n');
  
  // Get input message from command line or use default
  const inputMessage = process.argv[2] || 'Say "Config test successful!" and nothing else.';
  
  // Check environment
  console.log('1. Environment Variables:');
  console.log('   GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Not set');
  
  // Initialize config module
  console.log('\n2. Initializing Config Module...');
  const configModule = new ConfigModule();
  
  // Load module.yaml config
  const moduleYaml = readFileSync('./src/modules/core/config/module.yaml', 'utf8');
  const moduleConfig = parse(moduleYaml);
  
  await configModule.initialize({
    config: moduleConfig.config,
    logger: console
  });
  
  // Get Google config
  console.log('\n3. Google Configuration:');
  const googleConfig = configModule.get('google');
  console.log('   Config:', {
    ...googleConfig,
    apiKey: googleConfig?.apiKey ? '***' + googleConfig.apiKey.slice(-4) : 'Not set'
  });
  
  // Get model config
  console.log('\n4. Default Model Configuration:');
  const modelConfig = configModule.get('models.default');
  console.log('   Model:', modelConfig?.model);
  console.log('   Temperature:', modelConfig?.generationConfig?.temperature);
  console.log('   Max Tokens:', modelConfig?.generationConfig?.maxOutputTokens);
  
  // Test if we can create a client
  if (googleConfig?.apiKey && !googleConfig.apiKey.includes('${')) {
    console.log('\n5. Testing Google GenAI Client Creation...');
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const genai = new GoogleGenAI(googleConfig);
      console.log('   ✓ Client created successfully');
      
      // Try a simple generation using the models API
      console.log('   ✓ Models API available');
      
      // Try a simple generation
      console.log('\n6. Testing Generation...');
      console.log('   Input:', inputMessage);
      
      const result = await genai.models.generateContent({
        model: modelConfig.model,
        contents: [{ role: 'user', parts: [{ text: inputMessage }] }],
        generationConfig: modelConfig.generationConfig,
        safetySettings: modelConfig.safetySettings,
        systemInstruction: modelConfig.systemInstruction
      });
      
      console.log('\n7. Full Response:');
      console.log(JSON.stringify(result, null, 2));
      
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text';
      console.log('\n8. Extracted Text:');
      console.log(text);
      
    } catch (error: any) {
      console.error('   ✗ Error:', error.message);
    }
  } else {
    console.log('\n5. Cannot test client - API key not properly configured');
    console.log('   Please ensure GEMINI_API_KEY is set in your .env file');
  }
}

testGoogleConfig().catch(console.error);