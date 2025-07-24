export interface ProfileResult {
  duration: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    user: number;
    system: number;
  };
}

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
}

export interface LintResult {
  errors: number;
  warnings: number;
  fixed: number;
}

export interface FormatResult {
  filesFormatted: number;
}

export interface DevConfig {
  debugMode?: boolean;
  watchPatterns?: string[];
  testPatterns?: string[];
  lintConfig?: string;
  prettierConfig?: string;
}