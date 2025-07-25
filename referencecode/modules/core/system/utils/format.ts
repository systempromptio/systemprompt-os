/**
 * Formatting utilities
 */

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration in seconds to human readable format
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) {parts.push(`${days}d`);}
  if (hours > 0) {parts.push(`${hours}h`);}
  if (minutes > 0) {parts.push(`${minutes}m`);}
  if (secs > 0 || parts.length === 0) {parts.push(`${secs}s`);}

  return parts.join(' ');
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format timestamp
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}