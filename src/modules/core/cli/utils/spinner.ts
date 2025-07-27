/**
 * @file CLI spinner utilities for beautiful loading animations.
 * @module cli/utils/spinner
 */

import ora, { type Color, type Options, type Ora, type Spinner } from 'ora';
import { type SpinnerName } from 'cli-spinners';

/**
 * Spinner configuration interface.
 */
export interface ISpinnerConfig {
  text?: string;
  color?: Color;
  spinner?: SpinnerName | Spinner;
  interval?: number;
}

/**
 * SystemPrompt themed spinner presets.
 */
export const SPINNER_PRESETS = {
  loading: {
    spinner: 'dots' as SpinnerName,
    color: 'yellow' as Color,
    text: 'Loading...'
  },
  processing: {
    spinner: 'arc' as SpinnerName,
    color: 'yellow' as Color,
    text: 'Processing...'
  },
  connecting: {
    spinner: 'circle' as SpinnerName,
    color: 'blue' as Color,
    text: 'Connecting...'
  },
  saving: {
    spinner: 'squareCorners' as SpinnerName,
    color: 'green' as Color,
    text: 'Saving...'
  },
  analyzing: {
    spinner: 'triangle' as SpinnerName,
    color: 'cyan' as Color,
    text: 'Analyzing...'
  },
  building: {
    spinner: 'growHorizontal' as SpinnerName,
    color: 'magenta' as Color,
    text: 'Building...'
  }
} satisfies Record<string, ISpinnerConfig & { text: string }>;

/**
 * Enhanced spinner class with SystemPrompt theming.
 */
export class SystemPromptSpinner {
  private readonly spinner: Ora;
  private readonly startTime: number;
  get isSpinning(): boolean {
    return this.spinner.isSpinning;
  }

  /**
   * Start the spinner with optional text.
   * @param text - Optional text to display.
   * @returns This spinner instance.
   */
  start(text?: string): this {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.start();
    return this;
  }

  /**
   * Stop the spinner and show success.
   * @param text - Optional success text.
   * @returns This spinner instance.
   */
  succeed(text?: string): this {
    if (text !== undefined) {
      this.spinner.succeed(text);
    } else {
      this.spinner.succeed();
    }
    return this;
  }

  /**
   * Stop the spinner and show failure.
   * @param text - Optional failure text.
   * @returns This spinner instance.
   */
  fail(text?: string): this {
    if (text !== undefined) {
      this.spinner.fail(text);
    } else {
      this.spinner.fail();
    }
    return this;
  }

  /**
   * Update the spinner text.
   * @param text - New text to display.
   * @returns This spinner instance.
   */
  updateText(text: string): this {
    this.spinner.text = text;
    return this;
  }

  /**
   * Stop the spinner.
   * @returns This spinner instance.
   */
  stop(): this {
    this.spinner.stop();
    return this;
  }

  /**
   * Get the elapsed time since the spinner started.
   * @returns Elapsed time in milliseconds.
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Show warning message.
   * @param text - Optional warning text.
   * @returns This spinner instance.
   */
  warn(text?: string): this {
    if (text !== undefined) {
      this.spinner.warn(text);
    } else {
      this.spinner.warn();
    }
    return this;
  }

  /**
   * Show info message.
   * @param text - Optional info text.
   * @returns This spinner instance.
   */
  info(text?: string): this {
    if (text !== undefined) {
      this.spinner.info(text);
    } else {
      this.spinner.info();
    }
    return this;
  }
}

/**
 * Quick spinner factory functions.
 * @param preset - The spinner preset to use.
 * @param text - Optional text to override preset text.
 * @returns New SystemPromptSpinner instance.
 */
export const createSpinner = (preset: keyof typeof SPINNER_PRESETS = 'loading', text?: string): SystemPromptSpinner => {
  const config = { ...SPINNER_PRESETS[preset] };
  if (text) { config.text = text; }
  return new SystemPromptSpinner(config);
};

/**
 * Execute a function with a spinner.
 * @param fn - The async function to execute.
 * @param spinnerConfig - Spinner configuration.
 * @param options
 * @param successText - Success message.
 * @param errorText - Error message.
 * @param options.successText
 * @param options.errorText
 * @returns Promise with the function result.
 */
export const withSpinner = async <T>(
  fn: () => Promise<T>,
  spinnerConfig: ISpinnerConfig = {},
  options?: { successText?: string; errorText?: string }
): Promise<T> => {
  const spinner = new SystemPromptSpinner(spinnerConfig);
  
  try {
    spinner.start();
    const result = await fn();
    spinner.succeed(options?.successText);
    return result;
  } catch (error) {
    spinner.fail(options?.errorText ?? 'Operation failed');
    throw error;
  }
};

/**
 * Create a multi-step progress spinner.
 */
export class ProgressSpinner {
  private readonly spinner: SystemPromptSpinner;
  private readonly steps: string[];
  private currentStep: number = 0;

  constructor(steps: string[], config: ISpinnerConfig = {}) {
    this.steps = steps;
    this.spinner = new SystemPromptSpinner(config);
  }

  /**
   * Start the progress spinner.
   * @returns This progress spinner instance.
   */
  start(): this {
    if (this.steps.length > 0) {
      this.spinner.start(`[1/${String(this.steps.length)}] ${this.steps[0] ?? ''}`);
    }
    return this;
  }

  /**
   * Move to the next step.
   * @param successText - Optional success text for current step.
   * @returns This progress spinner instance.
   */
  nextStep(successText?: string): this {
    this.currentStep += 1;
    
    if (this.currentStep < this.steps.length) {
      if (successText) {
        this.spinner.updateText(`✓ ${successText}`);
        /**
         * Brief pause to show success.
         */
        setTimeout((): void => {
          this.spinner.updateText(`[${String(this.currentStep + 1)}/${String(this.steps.length)}] ${this.steps[this.currentStep] ?? ''}`);
        }, 500);
      } else {
        this.spinner.updateText(`[${String(this.currentStep + 1)}/${String(this.steps.length)}] ${this.steps[this.currentStep] ?? ''}`);
      }
    } else {
      this.spinner.succeed(successText ?? 'All steps completed');
    }
    
    return this;
  }

  /**
   * Complete the progress with success.
   * @param successText - Final success message.
   * @returns This progress spinner instance.
   */
  complete(successText?: string): this {
    this.spinner.succeed(successText ?? 'All steps completed');
    return this;
  }

  /**
   * Fail the progress.
   * @param errorText - Error message.
   * @returns This progress spinner instance.
   */
  fail(errorText?: string): this {
    this.spinner.fail(errorText ?? 'Operation failed');
    return this;
  }
}

/**
 * Create a progress spinner for multi-step operations.
 * @param steps - Array of step descriptions.
 * @param config - Spinner configuration.
 * @returns New progress spinner instance.
 */
export const createProgressSpinner = (steps: string[], config: ISpinnerConfig = {}): ProgressSpinner => {
  return new ProgressSpinner(steps, config);
};
