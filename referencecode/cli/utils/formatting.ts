/**
 * @fileoverview CLI formatting utilities for consistent output across all commands
 * Provides colors, styling, and formatting helpers for terminal output
 */

// ANSI color codes
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
} as const;

// Style functions
export const style = {
  // Basic styles
  bold: (text: string) => `${colors.bright}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
  italic: (text: string) => `${colors.italic}${text}${colors.reset}`,
  underline: (text: string) => `${colors.underline}${text}${colors.reset}`,
  
  // Colors
  red: (text: string) => `${colors.red}${text}${colors.reset}`,
  green: (text: string) => `${colors.green}${text}${colors.reset}`,
  yellow: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  blue: (text: string) => `${colors.blue}${text}${colors.reset}`,
  magenta: (text: string) => `${colors.magenta}${text}${colors.reset}`,
  cyan: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  gray: (text: string) => `${colors.gray}${text}${colors.reset}`,
  white: (text: string) => `${colors.white}${text}${colors.reset}`,
  
  // Semantic styles
  success: (text: string) => `${colors.green}${text}${colors.reset}`,
  error: (text: string) => `${colors.red}${text}${colors.reset}`,
  warning: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  info: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  muted: (text: string) => `${colors.gray}${text}${colors.reset}`,
  
  // Combined styles
  header: (text: string) => `${colors.bright}${colors.blue}${text}${colors.reset}`,
  label: (text: string) => `${colors.bright}${text}${colors.reset}`,
  code: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  path: (text: string) => `${colors.magenta}${text}${colors.reset}`,
  command: (text: string) => `${colors.bright}${colors.cyan}${text}${colors.reset}`,
} as const;

// Icons
export const icons = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  arrow: '→',
  bullet: '•',
  chevron: '›',
  check: '✓',
  cross: '✗',
  star: '★',
  circle: '●',
  square: '■',
  diamond: '◆',
  search: '🔍',
  folder: '📁',
  file: '📄',
  package: '📦',
  gear: '⚙️',
  rocket: '🚀',
  sparkles: '✨',
  fire: '🔥',
  chart: '📊',
  clock: '🕐',
  key: '🔑',
  lock: '🔒',
  shield: '🛡️',
} as const;

// Box drawing characters
export const boxChars = {
  // Single line
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  cross: '┼',
  teeRight: '├',
  teeLeft: '┤',
  teeDown: '┬',
  teeUp: '┴',
  
  // Double line
  dTopLeft: '╔',
  dTopRight: '╗',
  dBottomLeft: '╚',
  dBottomRight: '╝',
  dHorizontal: '═',
  dVertical: '║',
  
  // Rounded
  rTopLeft: '╭',
  rTopRight: '╮',
  rBottomLeft: '╰',
  rBottomRight: '╯',
} as const;

// Formatting helpers
export const format = {
  // Lines and dividers
  divider: (length: number = 60, char: string = '─') => style.dim(char.repeat(length)),
  doubleDivider: (length: number = 60) => style.dim('═'.repeat(length)),
  dashedDivider: (length: number = 60) => style.dim('┈'.repeat(length)),
  heavyDivider: (length: number = 60) => style.dim('━'.repeat(length)),
  
  // Gradient divider
  gradientDivider: (length: number = 60) => {
    const chars = ['━', '─', '┈', '·', ' ', '·', '┈', '─', '━'];
    const segment = Math.floor(length / chars.length);
    return style.dim(chars.map(c => c.repeat(segment)).join(''));
  },
  
  // Headers with styling
  title: (text: string, icon?: string) => {
    const iconStr = icon ? `${icon}  ` : '';
    const line = '━'.repeat(text.length + iconStr.length + 4);
    return `\n${style.dim(line)}\n${style.header(`${iconStr}${text}`)}\n${style.dim(line)}`;
  },
  
  // Fancy title with box
  boxTitle: (text: string, icon?: string) => {
    const iconStr = icon ? `${icon}  ` : '';
    const content = `${iconStr}${text}`;
    const width = content.length + 4;
    const top = `${boxChars.rTopLeft}${boxChars.horizontal.repeat(width)}${boxChars.rTopRight}`;
    const middle = `${boxChars.vertical}  ${style.header(content)}  ${boxChars.vertical}`;
    const bottom = `${boxChars.rBottomLeft}${boxChars.horizontal.repeat(width)}${boxChars.rBottomRight}`;
    return `\n${style.dim(top)}\n${middle}\n${style.dim(bottom)}`;
  },
  
  section: (text: string, icon?: string) => {
    const iconStr = icon ? `${icon} ` : '';
    return `\n${style.bold(`${iconStr}${text}`)}\n${style.dim('─'.repeat(text.length + iconStr.length))}`;
  },
  
  // Lists
  bulletItem: (text: string, indent: number = 0) => 
    `${' '.repeat(indent)}${style.muted(icons.bullet)} ${text}`,
  
  checkItem: (text: string, checked: boolean, indent: number = 0) => 
    `${' '.repeat(indent)}${checked ? style.success(icons.check) : style.muted(icons.square)} ${text}`,
  
  // Status indicators
  statusIcon: (status: 'success' | 'error' | 'warning' | 'info') => {
    switch (status) {
      case 'success': return style.success(icons.success);
      case 'error': return style.error(icons.error);
      case 'warning': return style.warning(icons.warning);
      case 'info': return style.info(icons.info);
    }
  },
  
  // Key-value pairs
  keyValue: (key: string, value: string | number, keyWidth: number = 0) => {
    const paddedKey = keyWidth > 0 ? key.padEnd(keyWidth) : key;
    return `${style.label(`${paddedKey  }:`)} ${value}`;
  },
  
  // Tables
  table: (headers: string[], rows: string[][], columnWidths?: number[]) => {
    const widths = columnWidths || headers.map((h, i) => 
      Math.max(h.length, ...rows.map(r => String(r[i] || '').length))
    );
    
    const lines: string[] = [];
    
    // Header
    const headerRow = headers.map((h, i) => h.padEnd(widths[i] ?? 0)).join(' │ ');
    lines.push(style.bold(headerRow));
    lines.push(widths.map(w => '─'.repeat(w)).join('─┼─'));
    
    // Rows
    for (const row of rows) {
      const rowStr = row.map((cell, i) => String(cell || '').padEnd(widths[i] ?? 0)).join(' │ ');
      lines.push(rowStr);
    }
    
    return lines.join('\n');
  },
  
  // Progress
  progressBar: (current: number, total: number, width: number = 30) => {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const bar = `${style.green('█'.repeat(filled))}${style.gray('░'.repeat(empty))}`;
    return `${bar} ${percentage}%`;
  },
  
  // Fancy progress bar with gradient
  gradientProgressBar: (current: number, total: number, width: number = 30) => {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const filledChars = '█'.repeat(filled).split('');
    const gradientFilled = filledChars.map((char, i) => {
      const ratio = i / filled;
      if (ratio < 0.33) {return style.red(char);}
      if (ratio < 0.66) {return style.yellow(char);}
      return style.green(char);
    }).join('');
    
    const bar = `${gradientFilled}${style.gray('░'.repeat(empty))}`;
    return `${bar} ${style.bold(`${percentage}%`)}`;
  },
  
  // Status badge
  badge: (text: string, type: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default') => {
    const styles = {
      success: (t: string) => `${colors.bgGreen}${colors.black} ${t} ${colors.reset}`,
      error: (t: string) => `${colors.bgRed}${colors.white} ${t} ${colors.reset}`,
      warning: (t: string) => `${colors.bgYellow}${colors.black} ${t} ${colors.reset}`,
      info: (t: string) => `${colors.bgBlue}${colors.white} ${t} ${colors.reset}`,
      default: (t: string) => `${colors.bgWhite}${colors.black} ${t} ${colors.reset}`,
    };
    return styles[type](text);
  },
  
  // Result box
  resultBox: (status: 'success' | 'error' | 'warning', message: string) => {
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
    };
    const colors = {
      success: style.green,
      error: style.error,
      warning: style.warning,
    };
    
    const icon = icons[status];
    const color = colors[status];
    const width = Math.max(message.length + 6, 40);
    
    const top = `${boxChars.rTopLeft}${boxChars.horizontal.repeat(width)}${boxChars.rTopRight}`;
    const middle = `${boxChars.vertical}  ${color(`${icon} ${message}`)}${' '.repeat(width - message.length - 4)}${boxChars.vertical}`;
    const bottom = `${boxChars.rBottomLeft}${boxChars.horizontal.repeat(width)}${boxChars.rBottomRight}`;
    
    return `${style.dim(top)}\n${middle}\n${style.dim(bottom)}`;
  },
  
  // Boxes
  box: (content: string, padding: number = 1) => {
    const lines = content.split('\n');
    const maxLength = Math.max(...lines.map(l => l.length));
    const width = maxLength + (padding * 2);
    
    const result: string[] = [];
    result.push(`┌${'─'.repeat(width)}┐`);
    
    for (const line of lines) {
      const paddedLine = line.padEnd(maxLength);
      result.push(`│${' '.repeat(padding)}${paddedLine}${' '.repeat(padding)}│`);
    }
    
    result.push(`└${'─'.repeat(width)}┘`);
    return style.dim(result.join('\n'));
  },
  
  // Indentation
  indent: (text: string, spaces: number = 2) => 
    text.split('\n').map(line => ' '.repeat(spaces) + line).join('\n'),
  
  // Truncation
  truncate: (text: string, maxLength: number, suffix: string = '...') => {
    if (text.length <= maxLength) {return text;}
    return text.slice(0, maxLength - suffix.length) + suffix;
  },
} as const;

// Spinner frames
export const spinners = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  circle: ['◐', '◓', '◑', '◒'],
  square: ['◰', '◳', '◲', '◱'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
} as const;

// Semantic output helpers
export const output = {
  success: (message: string) => 
    console.log(`${style.success(icons.success)} ${message}`),
  
  error: (message: string) => 
    console.error(`${style.error(icons.error)} ${message}`),
  
  warning: (message: string) => 
    console.warn(`${style.warning(icons.warning)} ${message}`),
  
  info: (message: string) => 
    console.log(`${style.info(icons.info)} ${message}`),
  
  debug: (message: string) => 
    console.log(`${style.gray('[DEBUG]')} ${style.gray(message)}`),
  
  step: (step: number, total: number, message: string) => 
    console.log(`${style.muted(`[${step}/${total}]`)} ${message}`),
  
  highlight: (label: string, value: string) => 
    console.log(`${style.label(`${label  }:`)} ${style.cyan(value)}`),
} as const;

// Export a unified interface
export default {
  colors,
  style,
  icons,
  format,
  spinners,
  output,
  boxChars,
};