/**
 * @file CLI spinner utilities for beautiful loading animations.
 * @module cli/utils/spinner
 */

import ora from 'ora';
import { randomBytes } from 'crypto';
import chalk from 'chalk';

/**
 * Spinner configuration interface.
 */
export interface SpinnerConfig {
  text?: string;
  color?: 'orange' | 'yellow' | 'green' | 'blue' | 'red' | 'magenta' | 'cyan' | 'white' | 'gray';
  spinner?: 'dots' | 'line' | 'pipe' | 'simpleDots' | 'simpleDotsScrolling' | 'star' | 'triangle' | 'arc' | 'circle' | 'squareCorners' | 'circleQuarters' | 'circleHalves' | 'squish' | 'toggle' | 'growVertical' | 'growHorizontal' | 'balloon' | 'balloon2' | 'noise' | 'bounce' | 'boxBounce' | 'boxBounce2' | 'triangle2' | 'arc2' | 'circle2';
  interval?: number;
}

/**
 * SystemPrompt themed spinner presets.
 */
export const SPINNER_PRESETS = {
  loading: {
    spinner: 'dots' as const,
    color: 'orange' as const,
    text: 'Loading...'
  },
  processing: {
    spinner: 'arc' as const,
    color: 'yellow' as const,
    text: 'Processing...'
  },
  connecting: {
    spinner: 'circle' as const,
    color: 'blue' as const,
    text: 'Connecting...'
  },
  saving: {
    spinner: 'squareCorners' as const,
    color: 'green' as const,
    text: 'Saving...'
  },
  analyzing: {
    spinner: 'triangle' as const,
    color: 'cyan' as const,
    text: 'Analyzing...'
  },
  building: {
    spinner: 'growHorizontal' as const,
    color: 'magenta' as const,
    text: 'Building...'
  }
};

/**
 * Enhanced spinner class with SystemPrompt theming.
 */
export class SystemPromptSpinner {
  private spinner: any;
  private startTime: number = 0;

  constructor(config: SpinnerConfig = {}) {
    const defaultConfig = SPINNER_PRESETS.loading;
    
    this.spinner = ora({
      text: config.text || defaultConfig.text,
      color: config.color || defaultConfig.color,
      spinner: config.spinner || defaultConfig.spinner,
      interval: config.interval || 100
    });
  }

  /**
   * Start the spinner with optional custom text.
   * @param text - Optional text to display.
   * @returns This spinner instance for chaining.
   */
  start(text?: string): SystemPromptSpinner {
    if (text) {
      this.spinner.text = text;
    }
    this.startTime = Date.now();
    this.spinner.start();
    return this;
  }

  /**
   * Stop the spinner and optionally display a success message.
   * @param successText - Optional success message.
   * @returns This spinner instance for chaining.
   */
  succeed(successText?: string): SystemPromptSpinner {
    const elapsed = this.getElapsedTime();
    const text = successText ? `${successText} ${elapsed}` : undefined;
    this.spinner.succeed(text);
    return this;
  }

  /**
   * Stop the spinner and display an error message.
   * @param errorText - Optional error message.
   * @returns This spinner instance for chaining.
   */
  fail(errorText?: string): SystemPromptSpinner {
    const elapsed = this.getElapsedTime();
    const text = errorText ? `${errorText} ${elapsed}` : undefined;
    this.spinner.fail(text);
    return this;
  }

  /**
   * Stop the spinner and display a warning message.
   * @param warningText - Optional warning message.
   * @returns This spinner instance for chaining.
   */
  warn(warningText?: string): SystemPromptSpinner {
    const elapsed = this.getElapsedTime();
    const text = warningText ? `${warningText} ${elapsed}` : undefined;
    this.spinner.warn(text);
    return this;
  }

  /**
   * Stop the spinner and display an info message.
   * @param infoText - Optional info message.
   * @returns This spinner instance for chaining.
   */
  info(infoText?: string): SystemPromptSpinner {
    const elapsed = this.getElapsedTime();
    const text = infoText ? `${infoText} ${elapsed}` : undefined;
    this.spinner.info(text);
    return this;
  }

  /**
   * Stop the spinner without any final message.
   * @returns This spinner instance for chaining.
   */
  stop(): SystemPromptSpinner {
    this.spinner.stop();
    return this;
  }

  /**
   * Update the spinner text while running.
   * @param text - New text to display.
   * @returns This spinner instance for chaining.
   */
  updateText(text: string): SystemPromptSpinner {
    this.spinner.text = text;
    return this;
  }

  /**
   * Update the spinner color while running.
   * @param color - New color to use.
   * @returns This spinner instance for chaining.
   */
  updateColor(color: SpinnerConfig['color']): SystemPromptSpinner {
    this.spinner.color = color;
    return this;
  }

  /**
   * Get elapsed time since spinner started.
   * @returns Formatted elapsed time string.
   */
  private getElapsedTime(): string {
    if (this.startTime === 0) return '';
    const elapsed = Date.now() - this.startTime;
    return chalk.dim(`(${elapsed}ms)`);
  }

  /**
   * Check if the spinner is currently spinning.
   * @returns True if spinning, false otherwise.
   */
  get isSpinning(): boolean {
    return this.spinner.isSpinning;
  }
}

/**
 * Quick spinner factory functions.
 */
export const createSpinner = (preset: keyof typeof SPINNER_PRESETS = 'loading', text?: string): SystemPromptSpinner => {
  const config = { ...SPINNER_PRESETS[preset] };
  if (text) config.text = text;
  return new SystemPromptSpinner(config);
};

/**
 * Execute a function with a spinner.
 * @param fn - The async function to execute.
 * @param spinnerConfig - Spinner configuration.
 * @param successText - Success message.
 * @param errorText - Error message.
 * @returns Promise with the function result.
 */
export const withSpinner = async <T>(
  fn: () => Promise<T>,
  spinnerConfig: SpinnerConfig = {},
  successText?: string,
  errorText?: string
): Promise<T> => {
  const spinner = new SystemPromptSpinner(spinnerConfig);
  
  try {
    spinner.start();
    const result = await fn();
    spinner.succeed(successText);
    return result;
  } catch (error) {
    spinner.fail(errorText || 'Operation failed');
    throw error;
  }
};

/**
 * Create a multi-step progress spinner.
 */
export class ProgressSpinner {
  private spinner: SystemPromptSpinner;
  private steps: string[];
  private currentStep: number = 0;

  constructor(steps: string[], config: SpinnerConfig = {}) {
    this.steps = steps;
    this.spinner = new SystemPromptSpinner(config);
  }

  /**
   * Start the progress spinner.
   * @returns This progress spinner instance.
   */
  start(): ProgressSpinner {
    if (this.steps.length > 0) {
      this.spinner.start(`[1/${this.steps.length}] ${this.steps[0]}`);
    }
    return this;
  }

  /**
   * Move to the next step.
   * @param successText - Optional success text for current step.
   * @returns This progress spinner instance.
   */
  nextStep(successText?: string): ProgressSpinner {
    this.currentStep++;
    
    if (this.currentStep < this.steps.length) {
      if (successText) {
        this.spinner.updateText(`✓ ${successText}`);
        // Brief pause to show success
        setTimeout(() => {
          this.spinner.updateText(`[${this.currentStep + 1}/${this.steps.length}] ${this.steps[this.currentStep]}`);
        }, 500);
      } else {
        this.spinner.updateText(`[${this.currentStep + 1}/${this.steps.length}] ${this.steps[this.currentStep]}`);
      }
    } else {
      this.spinner.succeed(successText || 'All steps completed');
    }
    
    return this;
  }

  /**
   * Complete the progress with success.
   * @param successText - Final success message.
   * @returns This progress spinner instance.
   */
  complete(successText?: string): ProgressSpinner {
    this.spinner.succeed(successText || 'All steps completed');
    return this;
  }

  /**
   * Fail the progress.
   * @param errorText - Error message.
   * @returns This progress spinner instance.
   */
  fail(errorText?: string): ProgressSpinner {
    this.spinner.fail(errorText || 'Operation failed');
    return this;
  }
}

/**
 * Create a progress spinner for multi-step operations.
 * @param steps - Array of step descriptions.
 * @param config - Spinner configuration.
 * @returns New progress spinner instance.
 */
export const createProgressSpinner = (steps: string[], config: SpinnerConfig = {}): ProgressSpinner => {
  return new ProgressSpinner(steps, config);
};