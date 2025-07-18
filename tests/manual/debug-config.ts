#!/usr/bin/env node
import { ConfigModule } from '../../src/modules/core/config/index.js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { parse } from 'yaml';

config();

async function debug() {
  console.log('ENV check:', {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY?.slice(0, 10) + '...',
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || 'not set'
  });

  const configModule = new ConfigModule();
  const moduleYaml = readFileSync('./src/modules/core/config/module.yaml', 'utf8');
  const moduleConfig = parse(moduleYaml);
  
  console.log('\nModule config google section:', moduleConfig.config.defaults.google);
  
  await configModule.initialize({
    config: moduleConfig.config,
    logger: console
  });
  
  // Get raw from store
  console.log('\nAll config keys:');
  const all = configModule.get();
  console.log(JSON.stringify(all, null, 2));
}

debug().catch(console.error);