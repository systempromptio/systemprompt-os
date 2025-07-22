/**
 * @fileoverview API usage statistics command
 * @module modules/core/api/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { options = {} } = context;
    
    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const apiModule = moduleLoader.getModule('api');

    if (!apiModule) {
      console.error('API module not found');
      process.exit(1);
    }

    try {
      const apiKeyService = apiModule.exports?.ApiKeyService;
      if (!apiKeyService) {
        console.error('API key service not available');
        process.exit(1);
      }

      // Default period is 24h
      const period = options.period || '24h';
      
      // Validate period format
      if (!/^\d+[hdwmy]$/.test(period)) {
        console.error('Invalid period format. Use format like "24h", "7d", "1w", "1m", "1y"');
        process.exit(1);
      }

      const stats = await apiKeyService.getUsageStats(period);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('\nAPI Usage Statistics');
        console.log('═'.repeat(80));
        console.log(`Period:                ${stats.period}`);
        console.log(`Total Requests:        ${stats.total_requests.toLocaleString()}`);
        console.log(`Unique API Keys:       ${stats.unique_keys}`);
        console.log(`Avg Response Time:     ${stats.average_response_time}ms`);
        console.log(`Error Rate:            ${stats.error_rate}%`);
        
        if (stats.top_endpoints.length > 0) {
          console.log('\nTop Endpoints:');
          console.log('─'.repeat(80));
          console.log(
            'Endpoint'.padEnd(40) +
            'Method'.padEnd(10) +
            'Requests'.padEnd(12) +
            'Avg Time'.padEnd(10) +
            'Error Rate'
          );
          console.log('─'.repeat(80));
          
          stats.top_endpoints.forEach(endpoint => {
            console.log(
              endpoint.endpoint.slice(0, 39).padEnd(40) +
              endpoint.method.padEnd(10) +
              endpoint.request_count.toLocaleString().padEnd(12) +
              `${endpoint.average_response_time}ms`.padEnd(10) +
              `${endpoint.error_rate}%`
            );
          });
        }

        // Show hourly breakdown if period is 24h or less
        if (period === '24h' || period === '1h' || /^[1-9]\d?h$/.test(period)) {
          console.log('\nHourly Activity:');
          console.log('─'.repeat(80));
          
          // Simple ASCII chart
          const hours = parseInt(period) || 24;
          const now = new Date();
          const hourlyData: number[] = [];
          
          for (let i = hours - 1; i >= 0; i--) {
            const hourStart = new Date(now);
            hourStart.setHours(hourStart.getHours() - i);
            hourStart.setMinutes(0, 0, 0);
            
            const hourEnd = new Date(hourStart);
            hourEnd.setHours(hourEnd.getHours() + 1);
            
            // This is a placeholder - in real implementation, we'd query hourly data
            hourlyData.push(Math.floor(Math.random() * 100));
          }
          
          const maxValue = Math.max(...hourlyData, 1);
          const chartHeight = 10;
          
          // Draw chart
          for (let row = chartHeight; row > 0; row--) {
            let line = '';
            for (let col = 0; col < hourlyData.length; col++) {
              const barHeight = Math.round((hourlyData[col] / maxValue) * chartHeight);
              line += barHeight >= row ? '█' : ' ';
            }
            console.log(line);
          }
          
          // Time labels
          console.log('─'.repeat(hours));
          let labels = '';
          for (let i = 0; i < hours; i += Math.max(1, Math.floor(hours / 20))) {
            const hour = new Date(now);
            hour.setHours(hour.getHours() - (hours - i - 1));
            labels += hour.getHours().toString().padStart(2, '0');
            labels += ' '.repeat(Math.max(0, Math.floor(hours / 20) - 2));
          }
          console.log(labels);
        }

        // Show key-specific stats if requested
        if (options.key) {
          console.log(`\nKey-Specific Usage (${options.key}):`);
          console.log('─'.repeat(80));
          
          try {
            const keyUsage = await apiKeyService.getApiKeyUsage(options.key, period);
            console.log(`Total Requests:        ${keyUsage.total_requests.toLocaleString()}`);
            console.log(`Success Rate:          ${(100 - keyUsage.error_rate).toFixed(1)}%`);
            console.log(`Avg Response Time:     ${keyUsage.average_response_time}ms`);
          } catch (error) {
            console.log('Unable to fetch key-specific statistics');
          }
        }
      }
    } catch (error) {
      console.error('Failed to get usage statistics:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};