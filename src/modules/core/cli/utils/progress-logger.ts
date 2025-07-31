/**
 * Progress logger configuration.
 */
export interface IProgressConfig {
  text?: string;
  spinner?: boolean;
  interval?: number;
}

/**
 * Spinner frames for animated progress indication.
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Simple progress logger class.
 */
export class ProgressLogger {
  private text: string;
  private readonly startTime: number;
  private readonly useSpinner: boolean;
  private readonly interval: number;
  private spinnerTimer?: NodeJS.Timeout | undefined;
  private currentFrame: number = 0;
  private isActive: boolean = false;
  private static readonly activeSpinners = new Set<ProgressLogger>();

  constructor(config: IProgressConfig = {}) {
    this.text = config.text ?? 'Processing...';
    this.startTime = Date.now();
    this.useSpinner = config.spinner ?? false;
    this.interval = config.interval ?? 120;
    
    // Cleanup on process exit
    if (ProgressLogger.activeSpinners.size === 0) {
      process.on('exit', ProgressLogger.cleanupAll);
      process.on('SIGINT', ProgressLogger.cleanupAll);
      process.on('SIGTERM', ProgressLogger.cleanupAll);
    }
  }

  /**
   * Cleanup all active spinners.
   */
  private static cleanupAll(): void {
    ProgressLogger.activeSpinners.forEach(spinner => {
      spinner.stopSpinner();
    });
    ProgressLogger.activeSpinners.clear();
  }

  /**
   * Start the spinner animation.
   */
  private startSpinner(): void {
    if (!this.useSpinner || this.isActive) {
      return;
    }

    // Stop any other active spinners first
    ProgressLogger.activeSpinners.forEach(spinner => {
      if (spinner !== this && spinner.isActive) {
        spinner.stopSpinner();
      }
    });

    this.isActive = true;
    ProgressLogger.activeSpinners.add(this);
    
    // Hide cursor
    process.stdout.write('\x1B[?25l');
    
    this.spinnerTimer = setInterval(() => {
      const frame = SPINNER_FRAMES[this.currentFrame % SPINNER_FRAMES.length];
      // Clear the entire line and move cursor to beginning
      process.stdout.write(`\r\x1B[K${frame ?? '⠋'} ${this.text}`);
      this.currentFrame += 1;
    }, this.interval);
  }

  /**
   * Stop the spinner animation.
   */
  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = undefined;
    }
    if (this.isActive) {
      ProgressLogger.activeSpinners.delete(this);
      this.isActive = false;
      // Show cursor again
      process.stdout.write('\x1B[?25h');
    }
  }

  /**
   * Clear the current line.
   */
  private clearLine(): void {
    if (this.useSpinner) {
      // Clear the entire line and move cursor to beginning
      process.stdout.write('\r\x1B[K');
    }
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
    
    if (this.useSpinner) {
      this.startSpinner();
    } else {
      process.stdout.write(`⏳ ${this.text}\n`);
    }
    return this;
  }

  /**
   * Show success message.
   * @param text - Optional success text.
   * @returns This logger instance.
   */
  succeed(text?: string): this {
    this.stopSpinner();
    this.clearLine();
    const message = text ?? this.text;
    const elapsed = this.getElapsedTime();
    process.stdout.write(`✅ ${message} (${String(elapsed)}ms)\n`);
    return this;
  }

  /**
   * Show failure message.
   * @param text - Optional failure text.
   * @returns This logger instance.
   */
  fail(text?: string): this {
    this.stopSpinner();
    this.clearLine();
    const message = text ?? this.text;
    const elapsed = this.getElapsedTime();
    process.stdout.write(`❌ ${message} (${String(elapsed)}ms)\n`);
    return this;
  }

  /**
   * Update the logger text.
   * @param text - New text to display.
   * @returns This logger instance.
   */
  updateText(text: string): this {
    this.text = text;
    if (!this.useSpinner) {
      process.stdout.write(`⏳ ${text}\n`);
    }
    return this;
  }

  /**
   * Update method for compatibility.
   * @param text - New text to display.
   * @returns This logger instance.
   */
  update(text: string): this {
    return this.updateText(text);
  }

  /**
   * Complete method for compatibility.
   * @param text - Optional completion text.
   * @returns This logger instance.
   */
  complete(text?: string): this {
    return this.succeed(text);
  }

  /**
   * Stop the logger.
   * @returns This logger instance.
   */
  stop(): this {
    this.stopSpinner();
    this.clearLine();
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
    this.stopSpinner();
    this.clearLine();
    const message = text ?? this.text;
    process.stdout.write(`⚠️  ${message}\n`);
    return this;
  }

  /**
   * Show info message.
   * @param text - Optional info text.
   * @returns This logger instance.
   */
  info(text?: string): this {
    this.stopSpinner();
    this.clearLine();
    const message = text ?? this.text;
    process.stdout.write(`ℹ️  ${message}\n`);
    return this;
  }
}

/**
 * Progress logger presets.
 */
export const PROGRESS_PRESETS = {
  loading: { text: 'Loading...',
spinner: true },
  processing: { text: 'Processing...',
spinner: true },
  connecting: { text: 'Connecting...',
spinner: true },
  saving: { text: 'Saving...',
spinner: true },
  analyzing: { text: 'Analyzing...',
spinner: true },
  building: { text: 'Building...',
spinner: true },
  static: { text: 'Processing...',
spinner: false }
};

/**
 * Create a progress logger.
 * @param preset - The preset to use.
 * @param text - Optional text to override preset text.
 * @returns New ProgressLogger instance.
 */
export const createProgressLogger = (
  preset: keyof typeof PROGRESS_PRESETS = 'loading',
  text?: string
): ProgressLogger => {
  const config = { ...PROGRESS_PRESETS[preset] };
  if (text) { config.text = text; }
  return new ProgressLogger(config);
};

/**
 * Execute a function with progress logging.
 * @param fn - The async function to execute.
 * @param config - Progress configuration.
 * @param options - Success and error text options.
 * @param options.successText - Text to display on success.
 * @param options.errorText - Text to display on error.
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
        process.stdout.write(`✓ ${successText}\n`);
      }
      const stepNum = String(this.currentStep + 1);
      const totalSteps = String(this.steps.length);
      const currentStepText = this.steps[this.currentStep] ?? '';
      const stepText = `[${stepNum}/${totalSteps}] ${currentStepText}`;
      this.logger.updateText(stepText);
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
