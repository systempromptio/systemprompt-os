/**
 * Progress logger configuration.
 */
export interface IProgressConfig {
  text?: string;
}

/**
 * Simple progress logger class.
 */
export class ProgressLogger {
  private text: string;
  private readonly startTime: number;

  constructor(config: IProgressConfig = {}) {
    this.text = config.text || 'Processing...';
    this.startTime = Date.now();
  }

  /**
   * Start the progress logger.
   * @param text - Optional text to display.
   * @returns This logger instance.
   */
  start(text?: string): this {
    if (text) {
      this.text = text;
    }
    console.log(`⏳ ${this.text}`);
    return this;
  }

  /**
   * Show success message.
   * @param text - Optional success text.
   * @returns This logger instance.
   */
  succeed(text?: string): this {
    const message = text || this.text;
    const elapsed = this.getElapsedTime();
    console.log(`✅ ${message} (${elapsed}ms)`);
    return this;
  }

  /**
   * Show failure message.
   * @param text - Optional failure text.
   * @returns This logger instance.
   */
  fail(text?: string): this {
    const message = text || this.text;
    const elapsed = this.getElapsedTime();
    console.log(`❌ ${message} (${elapsed}ms)`);
    return this;
  }

  /**
   * Update the logger text.
   * @param text - New text to display.
   * @returns This logger instance.
   */
  updateText(text: string): this {
    this.text = text;
    console.log(`⏳ ${text}`);
    return this;
  }

  /**
   * Stop the logger.
   * @returns This logger instance.
   */
  stop(): this {
    // No-op for compatibility
    return this;
  }

  /**
   * Get elapsed time since start.
   * @returns Elapsed time in milliseconds.
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Show warning message.
   * @param text - Optional warning text.
   * @returns This logger instance.
   */
  warn(text?: string): this {
    const message = text || this.text;
    console.log(`⚠️  ${message}`);
    return this;
  }

  /**
   * Show info message.
   * @param text - Optional info text.
   * @returns This logger instance.
   */
  info(text?: string): this {
    const message = text || this.text;
    console.log(`ℹ️  ${message}`);
    return this;
  }
}

/**
 * Progress logger presets.
 */
export const PROGRESS_PRESETS = {
  loading: { text: 'Loading...' },
  processing: { text: 'Processing...' },
  connecting: { text: 'Connecting...' },
  saving: { text: 'Saving...' },
  analyzing: { text: 'Analyzing...' },
  building: { text: 'Building...' }
};

/**
 * Create a progress logger.
 * @param preset - The preset to use.
 * @param text - Optional text to override preset text.
 * @returns New ProgressLogger instance.
 */
export const createProgressLogger = (preset: keyof typeof PROGRESS_PRESETS = 'loading', text?: string): ProgressLogger => {
  const config = { ...PROGRESS_PRESETS[preset] };
  if (text) { config.text = text; }
  return new ProgressLogger(config);
};

/**
 * Execute a function with progress logging.
 * @param fn - The async function to execute.
 * @param config - Progress configuration.
 * @param options - Success and error text options.
 * @param options.successText
 * @param options.errorText
 * @returns Promise with the function result.
 */
export const withProgress = async <T>(
  fn: () => Promise<T>,
  config: IProgressConfig = {},
  options?: { successText?: string; errorText?: string }
): Promise<T> => {
  const logger = new ProgressLogger(config);
  
  try {
    logger.start();
    const result = await fn();
    logger.succeed(options?.successText);
    return result;
  } catch (error) {
    logger.fail(options?.errorText ?? 'Operation failed');
    throw error;
  }
};

/**
 * Multi-step progress logger.
 */
export class MultiStepProgress {
  private readonly logger: ProgressLogger;
  private readonly steps: string[];
  private currentStep: number = 0;

  constructor(steps: string[], config: IProgressConfig = {}) {
    this.steps = steps;
    this.logger = new ProgressLogger(config);
  }

  /**
   * Start the progress.
   * @returns This progress instance.
   */
  start(): this {
    if (this.steps.length > 0) {
      this.logger.start(`[1/${String(this.steps.length)}] ${this.steps[0] ?? ''}`);
    }
    return this;
  }

  /**
   * Move to the next step.
   * @param successText - Optional success text for current step.
   * @returns This progress instance.
   */
  nextStep(successText?: string): this {
    this.currentStep += 1;
    
    if (this.currentStep < this.steps.length) {
      if (successText) {
        console.log(`✓ ${successText}`);
      }
      this.logger.updateText(`[${String(this.currentStep + 1)}/${String(this.steps.length)}] ${this.steps[this.currentStep] ?? ''}`);
    } else {
      this.logger.succeed(successText ?? 'All steps completed');
    }
    
    return this;
  }

  /**
   * Complete the progress with success.
   * @param successText - Final success message.
   * @returns This progress instance.
   */
  complete(successText?: string): this {
    this.logger.succeed(successText ?? 'All steps completed');
    return this;
  }

  /**
   * Fail the progress.
   * @param errorText - Error message.
   * @returns This progress instance.
   */
  fail(errorText?: string): this {
    this.logger.fail(errorText ?? 'Operation failed');
    return this;
  }
}

/**
 * Create a multi-step progress logger.
 * @param steps - Array of step descriptions.
 * @param config - Progress configuration.
 * @returns New multi-step progress instance.
 */
export const createMultiStepProgress = (steps: string[], config: IProgressConfig = {}): MultiStepProgress => {
  return new MultiStepProgress(steps, config);
};
