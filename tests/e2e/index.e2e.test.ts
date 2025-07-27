/**
 * Main E2E Test Suite
 * 
 * This file imports all domain test files for SystemPrompt OS.
 * The actual bootstrap and cleanup is handled by setup.ts.
 * 
 * Test Organization:
 * - 00-tools-cli: Tests CLI commands and tool functionality
 * - 01-server-external: Tests external server endpoints (health, status)
 * - 02-server-auth: Tests OAuth2 authentication flow
 * - 03-server-mcp: Tests MCP (Model Context Protocol) server functionality
 * - 04-modules-core: Tests core modules (heartbeat, logger, system)
 * - 05-google-live-api: Tests Google Live API integration with config module
 */

// Import all domain test suites
import './00-tools-cli.e2e.test';
import './01-server-external.e2e.test';
import './02-server-auth.e2e.spec';
import './03-server-mcp.e2e.test';
import './04-modules-core.e2e.test';
import './05-google-live-api.e2e.test';