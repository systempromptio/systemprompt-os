#!/usr/bin/env node
/**
 * Manual integration test for Google Live API
 * 
 * Usage:
 *   GOOGLE_AI_API_KEY=your-key npx tsx tests/integration/google-live-api.test.ts
 */

import { GoogleGenAI } from '@google/genai';
import { ConfigModule } from '../../src/modules/core/config/index.js';
import { defaultGoogleOptions, modelPresets } from '../../src/modules/core/config/providers/google.js';

async function testGoogleLiveAPI() {
  console.log('🧪 Testing Google Live API Integration...\n');

  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY environment variable is required');
    console.log('Usage: GEMINI_API_KEY=your-key npx tsx tests/integration/google-live-api.test.ts');
    process.exit(1);
  }

  try {
    // Initialize config module
    console.log('1️⃣ Initializing Config Module...');
    const configModule = new ConfigModule();
    await configModule.initialize({ 
      config: {
        defaults: {
          google: {
            ...defaultGoogleOptions,
            apiKey: process.env.GEMINI_API_KEY
          },
          models: modelPresets
        }
      },
      logger: console
    });

    // Get Google configuration
    console.log('2️⃣ Getting Google configuration from Config Module...');
    const googleConfig = configModule.get('google');
    console.log('Google Config:', {
      ...googleConfig,
      apiKey: googleConfig.apiKey ? '***hidden***' : undefined
    });

    // Get model configuration
    console.log('\n3️⃣ Getting model configuration...');
    const modelConfig = configModule.get('models.default');
    console.log('Model Config:', JSON.stringify(modelConfig, null, 2));

    // Initialize Google GenAI
    console.log('\n4️⃣ Initializing Google GenAI client...');
    const genai = new GoogleGenAI(googleConfig);

    // Create model instance
    console.log('5️⃣ Creating model instance...');
    const model = genai.getGenerativeModel({
      model: modelConfig.model,
      generationConfig: modelConfig.generationConfig,
      safetySettings: modelConfig.safetySettings,
      systemInstruction: modelConfig.systemInstruction
    });

    // Test simple generation
    console.log('\n6️⃣ Testing simple text generation...');
    const prompt = 'Write a haiku about configuration management.';
    console.log(`Prompt: "${prompt}"`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Response:', text);

    // Test streaming
    console.log('\n7️⃣ Testing streaming generation...');
    const streamPrompt = 'Count from 1 to 5 slowly.';
    console.log(`Prompt: "${streamPrompt}"`);
    console.log('Streaming response:');
    
    const streamResult = await model.generateContentStream(streamPrompt);
    for await (const chunk of streamResult.stream) {
      process.stdout.write(chunk.text());
    }
    console.log('\n');

    // Test with different preset (coder)
    console.log('\n8️⃣ Testing with coder preset...');
    const coderConfig = configModule.get('models.coder');
    const coderModel = genai.getGenerativeModel({
      model: coderConfig.model,
      generationConfig: coderConfig.generationConfig,
      systemInstruction: coderConfig.systemInstruction
    });

    const codePrompt = 'Write a TypeScript function to merge two sorted arrays.';
    console.log(`Prompt: "${codePrompt}"`);
    
    const codeResult = await coderModel.generateContent(codePrompt);
    const codeResponse = await codeResult.response;
    console.log('Response:', codeResponse.text());

    console.log('\n✅ All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testGoogleLiveAPI().catch(console.error);