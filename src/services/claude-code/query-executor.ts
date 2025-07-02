/**
 * @fileoverview Query execution for Claude Code service using SDK
 * @module services/claude-code/query-executor
 * 
 * @remarks
 * This module provides query execution capabilities using the Claude Code SDK.
 * It handles timeout management, error processing, and message extraction.
 * The executor integrates with the Claude Code SDK to send prompts and
 * receive streaming responses.
 * 
 * @example
 * ```typescript
 * import { QueryExecutor } from './query-executor';
 * 
 * const executor = new QueryExecutor();
 * 
 * const result = await executor.execute(session, 'Implement login', {
 *   maxTurns: 20,
 *   timeout: 300000
 * });
 * 
 * console.log('Response:', result.content);
 * console.log('Messages:', result.messages.length);
 * ```
 */

import { query, type SDKMessage, type SDKAssistantMessage, type Options } from '@anthropic-ai/claude-code';
import type { ClaudeCodeSession, ClaudeCodeOptions, QueryResult } from './types.js';
import { 
  QueryTimeoutError, 
  QueryAbortedError,
  CreditBalanceError,
  InvalidApiKeyError 
} from './errors.js';
import { 
  DEFAULT_TIMEOUT_MS, 
  DOCKER_WORKSPACE_PATH,
  ERROR_PATTERNS 
} from './constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Executes queries using the Claude Code SDK
 * 
 * @class QueryExecutor
 * 
 * @remarks
 * This class provides a high-level interface for executing queries
 * with the Claude Code SDK. It manages timeouts, handles errors,
 * and processes responses into a structured format.
 */
export class QueryExecutor {
  /**
   * Executes a query using the Claude Code SDK
   * 
   * @param session - The Claude Code session
   * @param prompt - The prompt to send to Claude
   * @param options - Optional query configuration
   * @returns The query result with content and messages
   * @throws {QueryTimeoutError} If query exceeds timeout
   * @throws {QueryAbortedError} If query is aborted
   * @throws {CreditBalanceError} If credit balance is insufficient
   * @throws {InvalidApiKeyError} If API key is invalid
   * 
   * @example
   * ```typescript
   * try {
   *   const result = await executor.execute(
   *     session,
   *     'Add error handling to the user service',
   *     { maxTurns: 25 }
   *   );
   * } catch (error) {
   *   if (error instanceof QueryTimeoutError) {
   *     console.error('Query timed out');
   *   }
   * }
   * ```
   */
  async execute(
    session: ClaudeCodeSession,
    prompt: string,
    options?: Partial<ClaudeCodeOptions>
  ): Promise<QueryResult> {
    const timeoutMs = options?.timeout || DEFAULT_TIMEOUT_MS;
    const messages: SDKMessage[] = [];
    let timeoutId: NodeJS.Timeout | null = null;

    const abortController = new AbortController();
    session.abortController = abortController;

    try {
      const queryOptions = this.buildQueryOptions(session, options);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(new QueryTimeoutError(timeoutMs));
        }, timeoutMs);
      });

      const queryPromise = this.executeQuery(
        prompt,
        abortController,
        queryOptions,
        messages,
        session
      );

      await Promise.race([queryPromise, timeoutPromise]);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return {
        content: this.extractContent(messages),
        messages
      };
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const processedError = this.processError(error, messages);
      throw processedError;
    } finally {
      session.abortController = undefined;
    }
  }

  /**
   * Builds query options from session and override options
   * 
   * @private
   * @param session - The Claude Code session
   * @param overrides - Optional override options
   * @returns Merged query options
   */
  private buildQueryOptions(
    session: ClaudeCodeSession, 
    overrides?: Partial<ClaudeCodeOptions>
  ): Options {
    const options: Options = {};

    options.cwd = DOCKER_WORKSPACE_PATH;

    if (session.options.maxTurns) options.maxTurns = session.options.maxTurns;
    if (session.options.model) options.model = session.options.model;
    if (session.options.allowedTools) options.allowedTools = session.options.allowedTools;
    if (session.options.customSystemPrompt) options.customSystemPrompt = session.options.customSystemPrompt;

    if (overrides?.maxTurns) options.maxTurns = overrides.maxTurns;
    if (overrides?.model) options.model = overrides.model;
    if (overrides?.allowedTools) options.allowedTools = overrides.allowedTools;
    if (overrides?.customSystemPrompt) options.customSystemPrompt = overrides.customSystemPrompt;

    return options;
  }

  /**
   * Executes the actual query using the SDK
   * 
   * @private
   * @param prompt - The prompt to execute
   * @param abortController - Controller for aborting the query
   * @param options - Query options
   * @param messages - Array to collect messages
   * @param session - The Claude Code session
   * @throws {QueryAbortedError} If query is aborted
   */
  private async executeQuery(
    prompt: string,
    abortController: AbortController,
    options: Options,
    messages: SDKMessage[],
    session: ClaudeCodeSession
  ): Promise<void> {
    try {
      for await (const message of query({ prompt, abortController, options })) {
        messages.push(message);
        session.outputBuffer.push(message);
        session.lastActivity = new Date();
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new QueryAbortedError(error instanceof Error ? error.message : 'Unknown error');
      }
      throw error;
    }
  }

  /**
   * Extracts text content from SDK messages
   * 
   * @private
   * @param messages - Array of SDK messages
   * @returns Concatenated text content
   */
  private extractContent(messages: SDKMessage[]): string {
    return messages
      .filter((m): m is SDKAssistantMessage => m.type === 'assistant')
      .map(m => {
        if (m.message?.content && Array.isArray(m.message.content)) {
          return m.message.content
            .filter((c: unknown): c is { type: 'text'; text: string } => 
              typeof c === 'object' && c !== null && 'type' in c && c.type === 'text' && 'text' in c && typeof c.text === 'string'
            )
            .map((c: { type: 'text'; text: string }) => c.text)
            .join('');
        }
        return '';
      })
      .join('\n');
  }

  /**
   * Processes errors and returns appropriate error types
   * 
   * @private
   * @param error - The original error
   * @param messages - Messages received before error
   * @returns Processed error with appropriate type
   * 
   * @remarks
   * This method analyzes error messages to determine specific error
   * types like credit balance or API key issues. It examines the
   * last assistant message for known error patterns.
   */
  private processError(error: unknown, messages: SDKMessage[]): Error {
    logger.error('Query execution failed', { error });

    const lastAssistantMessage = messages
      .filter((m): m is SDKAssistantMessage => m.type === 'assistant')
      .pop();

    if (lastAssistantMessage?.message?.content) {
      const content = lastAssistantMessage.message.content;
      if (Array.isArray(content)) {
        const textContent = content
          .filter((c: unknown): c is { type: 'text'; text: string } => 
            typeof c === 'object' && c !== null && 'type' in c && c.type === 'text' && 'text' in c && typeof c.text === 'string'
          )
          .map((c: { type: 'text'; text: string }) => c.text)
          .join(' ');

        if (textContent.includes(ERROR_PATTERNS.CREDIT_BALANCE)) {
          return new CreditBalanceError();
        }
        if (textContent.includes(ERROR_PATTERNS.INVALID_API_KEY)) {
          return new InvalidApiKeyError();
        }
      }
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}