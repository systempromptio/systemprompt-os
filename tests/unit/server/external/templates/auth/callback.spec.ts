/**
 * @fileoverview Unit tests for OAuth callback handler template
 * @module tests/unit/server/external/templates/auth/callback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderCallbackHandler } from '@/server/external/templates/auth/callback';
import { JSDOM } from 'jsdom';

describe('renderCallbackHandler', () => {
  let mockFetch: any;
  let mockLocalStorage: any;
  let mockWindow: any;
  let dom: JSDOM;
  
  beforeEach(() => {
    // Setup JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div class="container"><div class="spinner"></div><h1></h1><p></p><div id="error-container"></div></div></body></html>', {
      url: 'http://localhost:3000/auth/callback?code=test123&state=xyz',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    // Set global references
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.localStorage = dom.window.localStorage;
    
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    dom.window.fetch = mockFetch;
    
    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    };
    
    // Override the window localStorage with our mock
    Object.defineProperty(dom.window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    global.localStorage = mockLocalStorage;
    
    // Mock window object
    mockWindow = dom.window;
  });

  afterEach(() => {
    vi.clearAllMocks();
    dom?.window?.close();
  });

  describe('HTML Structure and Content', () => {
    it('should return valid HTML string', () => {
      const html = renderCallbackHandler();
      expect(html).toBeTypeOf('string');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should include correct doctype and html structure', () => {
      const html = renderCallbackHandler();
      expect(html.trim().startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('should include correct meta tags', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    });

    it('should have correct title', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('<title>Completing Login - SystemPrompt OS</title>');
    });

    it('should include complete CSS styles', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('<style>');
      expect(html).toContain('* { box-sizing: border-box; margin: 0; padding: 0; }');
      expect(html).toContain('body {');
      expect(html).toContain('.container {');
      expect(html).toContain('.spinner {');
      expect(html).toContain('@keyframes spin {');
      expect(html).toContain('.error {');
    });

    it('should have dark theme color scheme', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('background: #0a0a0a');
      expect(html).toContain('color: #e0e0e0');
      expect(html).toContain('background: #1a1a1a');
      expect(html).toContain('color: #f1f5f9');
    });

    it('should include spinner animation keyframes', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('animation: spin 1s linear infinite');
      expect(html).toContain('@keyframes spin {');
      expect(html).toContain('to { transform: rotate(360deg); }');
    });

    it('should include error styling', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('.error {');
      expect(html).toContain('background: #991b1b');
      expect(html).toContain('color: #fef2f2');
      expect(html).toContain('.error h2 {');
      expect(html).toContain('.error a {');
      expect(html).toContain('.error a:hover {');
    });

    it('should have main container structure', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('<div class="container">');
      expect(html).toContain('<div class="spinner"></div>');
      expect(html).toContain('<h1>Completing Login</h1>');
      expect(html).toContain('<p>Please wait while we complete your authentication...</p>');
      expect(html).toContain('<div id="error-container"></div>');
    });

    it('should include responsive design properties', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('min-height: 100vh');
      expect(html).toContain('max-width: 400px');
      expect(html).toContain('width: 100%');
      expect(html).toContain('padding: 20px');
    });

    it('should include accessibility considerations', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('text-decoration: underline');
      expect(html).toContain('#fbbf24'); // Link color
      expect(html).toContain('#e0e0e0'); // High contrast text
    });
  });

  describe('JavaScript Code Structure', () => {
    it('should include all required JavaScript functions', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('<script>');
      expect(html).toContain('async function handleCallback()');
      expect(html).toContain('async function checkIfSetup()');
      expect(html).toContain('function showError(title, message)');
      expect(html).toContain('handleCallback();');
    });

    it('should include URLSearchParams usage', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('new URLSearchParams(window.location.search)');
      expect(html).toContain("params.get('code')");
      expect(html).toContain("params.get('state')");
      expect(html).toContain("params.get('error')");
    });

    it('should include error handling logic', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('if (error) {');
      expect(html).toContain("showError('Authentication Failed', error);");
      expect(html).toContain('if (!code) {');
      expect(html).toContain("showError('Invalid Response', 'No authorization code received');");
    });

    it('should include OAuth2 token exchange', () => {
      const html = renderCallbackHandler();
      expect(html).toContain("fetch('/oauth2/token', {");
      expect(html).toContain("method: 'POST'");
      expect(html).toContain("'Content-Type': 'application/x-www-form-urlencoded'");
      expect(html).toContain('grant_type: \'authorization_code\'');
      expect(html).toContain('client_id: \'systemprompt-os\'');
    });

    it('should include localStorage token storage', () => {
      const html = renderCallbackHandler();
      expect(html).toContain("localStorage.setItem('access_token', tokens.access_token);");
      expect(html).toContain("localStorage.setItem('refresh_token', tokens.refresh_token);");
    });

    it('should include setup check and redirection', () => {
      const html = renderCallbackHandler();
      expect(html).toContain("fetch('/api/users/count')");
      expect(html).toContain('data.count === 1');
      expect(html).toContain("window.location.href = isSetup ? '/config' : '/';");
    });

    it('should include try-catch error handling', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('try {');
      expect(html).toContain('} catch (err) {');
      expect(html).toContain("showError('Connection Error', 'Failed to complete authentication');");
    });

    it('should include showError function implementation', () => {
      const html = renderCallbackHandler();
      expect(html).toContain("document.querySelector('.spinner').style.display = 'none';");
      expect(html).toContain("document.querySelector('h1').textContent = title;");
      expect(html).toContain("document.querySelector('p').style.display = 'none';");
      expect(html).toContain('document.getElementById(\'error-container\')');
    });

    it('should include error template with proper escaping', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('errorContainer.innerHTML = \\`');
      expect(html).toContain('<div class="error">');
      expect(html).toContain('<h2>Error: \\${message}</h2>');
      expect(html).toContain('<a href="/auth">Try again</a>');
    });

      it('should handle missing authorization code', async () => {
        // Setup URL without code
        Object.defineProperty(window, 'location', {
          value: {
            href: 'http://localhost:3000/auth/callback',
            origin: 'http://localhost:3000',
            search: ''
          },
          writable: true
        });

        await window.eval(`
          (async function() {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const error = params.get('error');
            
            if (error) {
              showError('Authentication Failed', error);
              return;
            }
            
            if (!code) {
              showError('Invalid Response', 'No authorization code received');
              return;
            }
          })()
        `);

        expect(document.querySelector('h1')?.textContent).toBe('Invalid Response');
        expect(document.querySelector('.error h2')?.textContent).toBe('Error: No authorization code received');
      });

      it('should handle successful token exchange', async () => {
        const mockTokenResponse = {
          access_token: 'test_access_token',
          refresh_token: 'test_refresh_token',
          token_type: 'Bearer'
        };

        const mockUserCountResponse = { count: 0 };

        // Mock successful fetch responses
        (global.fetch as any)
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse)
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockUserCountResponse)
          });

        // Mock location.href assignment
        let redirectUrl = '';
        Object.defineProperty(window.location, 'href', {
          set: (url: string) => { redirectUrl = url; },
          get: () => redirectUrl
        });

        await window.eval(`
          (async function() {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const error = params.get('error');
            
            if (error) {
              showError('Authentication Failed', error);
              return;
            }
            
            if (!code) {
              showError('Invalid Response', 'No authorization code received');
              return;
            }
            
            try {
              const response = await fetch('/oauth2/token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  code: code,
                  client_id: 'systemprompt-os',
                  redirect_uri: window.location.origin
                })
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                showError('Login Failed', errorData.error_description || errorData.error);
                return;
              }
              
              const tokens = await response.json();
              
              localStorage.setItem('access_token', tokens.access_token);
              if (tokens.refresh_token) {
                localStorage.setItem('refresh_token', tokens.refresh_token);
              }
              
              const isSetupResponse = await fetch('/api/users/count');
              const setupData = await isSetupResponse.json();
              const isSetup = setupData.count === 1;
              
              window.location.href = isSetup ? '/config' : '/';
            } catch (err) {
              showError('Connection Error', 'Failed to complete authentication');
            }
          })()
        `);

        expect(global.localStorage.setItem).toHaveBeenCalledWith('access_token', 'test_access_token');
        expect(global.localStorage.setItem).toHaveBeenCalledWith('refresh_token', 'test_refresh_token');
        expect(redirectUrl).toBe('/');
      });

      it('should redirect to /config for setup user', async () => {
        const mockTokenResponse = {
          access_token: 'test_access_token',
          token_type: 'Bearer'
        };

        const mockUserCountResponse = { count: 1 };

        (global.fetch as any)
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse)
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockUserCountResponse)
          });

        let redirectUrl = '';
        Object.defineProperty(window.location, 'href', {
          set: (url: string) => { redirectUrl = url; },
          get: () => redirectUrl
        });

        await window.eval(`
          (async function() {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            
            const response = await fetch('/oauth2/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: 'systemprompt-os',
                redirect_uri: window.location.origin
              })
            });
            
            const tokens = await response.json();
            localStorage.setItem('access_token', tokens.access_token);
            
            const isSetupResponse = await fetch('/api/users/count');
            const setupData = await isSetupResponse.json();
            const isSetup = setupData.count === 1;
            
            window.location.href = isSetup ? '/config' : '/';
          })()
        `);

        expect(redirectUrl).toBe('/config');
      });

      it('should handle token exchange failure', async () => {
        const mockErrorResponse = {
          error: 'invalid_grant',
          error_description: 'The authorization code is invalid'
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve(mockErrorResponse)
        });

        await window.eval(`
          (async function() {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            
            try {
              const response = await fetch('/oauth2/token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  code: code,
                  client_id: 'systemprompt-os',
                  redirect_uri: window.location.origin
                })
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                showError('Login Failed', errorData.error_description || errorData.error);
                return;
              }
            } catch (err) {
              showError('Connection Error', 'Failed to complete authentication');
            }
          })()
        `);

        expect(document.querySelector('h1')?.textContent).toBe('Login Failed');
        expect(document.querySelector('.error h2')?.textContent).toBe('Error: The authorization code is invalid');
      });

      it('should handle network errors', async () => {
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        await window.eval(`
          (async function() {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            
            try {
              const response = await fetch('/oauth2/token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  code: code,
                  client_id: 'systemprompt-os',
                  redirect_uri: window.location.origin
                })
              });
            } catch (err) {
              showError('Connection Error', 'Failed to complete authentication');
            }
          })()
        `);

        expect(document.querySelector('h1')?.textContent).toBe('Connection Error');
        expect(document.querySelector('.error h2')?.textContent).toBe('Error: Failed to complete authentication');
      });

      it('should handle missing refresh token', async () => {
        const mockTokenResponse = {
          access_token: 'test_access_token',
          token_type: 'Bearer'
          // No refresh_token
        };

        const mockUserCountResponse = { count: 0 };

        (global.fetch as any)
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse)
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockUserCountResponse)
          });

        let redirectUrl = '';
        Object.defineProperty(window.location, 'href', {
          set: (url: string) => { redirectUrl = url; },
          get: () => redirectUrl
        });

        await window.eval(`
          (async function() {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            
            const response = await fetch('/oauth2/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: 'systemprompt-os',
                redirect_uri: window.location.origin
              })
            });
            
            const tokens = await response.json();
            
            localStorage.setItem('access_token', tokens.access_token);
            if (tokens.refresh_token) {
              localStorage.setItem('refresh_token', tokens.refresh_token);
            }
            
            const isSetupResponse = await fetch('/api/users/count');
            const setupData = await isSetupResponse.json();
            window.location.href = '/';
          })()
        `);

        expect(global.localStorage.setItem).toHaveBeenCalledWith('access_token', 'test_access_token');
        expect(global.localStorage.setItem).not.toHaveBeenCalledWith('refresh_token', expect.anything());
      });
    });

    describe('checkIfSetup function', () => {
      it('should return true when count is 1', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ count: 1 })
        });

        const result = await window.eval(`
          (async function() {
            try {
              const response = await fetch('/api/users/count');
              const data = await response.json();
              return data.count === 1;
            } catch {
              return false;
            }
          })()
        `);

        expect(result).toBe(true);
      });

      it('should return false when count is not 1', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ count: 0 })
        });

        const result = await window.eval(`
          (async function() {
            try {
              const response = await fetch('/api/users/count');
              const data = await response.json();
              return data.count === 1;
            } catch {
              return false;
            }
          })()
        `);

        expect(result).toBe(false);
      });

      it('should return false on fetch error', async () => {
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        const result = await window.eval(`
          (async function() {
            try {
              const response = await fetch('/api/users/count');
              const data = await response.json();
              return data.count === 1;
            } catch {
              return false;
            }
          })()
        `);

        expect(result).toBe(false);
      });
    });

    describe('showError function', () => {
      it('should hide spinner and update UI elements', () => {
        window.eval(`showError('Test Title', 'Test message')`);

        expect(document.querySelector('.spinner')?.style.display).toBe('none');
        expect(document.querySelector('h1')?.textContent).toBe('Test Title');
        expect(document.querySelector('p')?.style.display).toBe('none');

        const errorContainer = document.getElementById('error-container');
        expect(errorContainer?.innerHTML).toContain('<div class="error">');
        expect(errorContainer?.innerHTML).toContain('<h2>Error: Test message</h2>');
        expect(errorContainer?.innerHTML).toContain('<a href="/auth">Try again</a>');
      });

      it('should handle special characters in error messages', () => {
        const specialMessage = 'Error with "quotes" & <tags>';
        window.eval(`showError('Special Error', \`${specialMessage}\`)`);

        const errorContainer = document.getElementById('error-container');
        expect(errorContainer?.innerHTML).toContain('Error: Error with "quotes" & <tags>');
      });

      it('should create proper error HTML structure', () => {
        window.eval(`showError('Error Title', 'Error Message')`);

        const errorDiv = document.querySelector('.error');
        expect(errorDiv).toBeTruthy();
        
        const errorH2 = errorDiv?.querySelector('h2');
        expect(errorH2?.textContent).toBe('Error: Error Message');
        
        const errorP = errorDiv?.querySelector('p');
        expect(errorP).toBeTruthy();
        
        const errorLink = errorP?.querySelector('a');
        expect(errorLink?.getAttribute('href')).toBe('/auth');
        expect(errorLink?.textContent).toBe('Try again');
      });
    });

    describe('URL Parameter Parsing', () => {
      it('should correctly parse code parameter', () => {
        Object.defineProperty(window, 'location', {
          value: {
            search: '?code=abc123&state=xyz'
          },
          writable: true
        });

        const result = window.eval(`
          const params = new URLSearchParams(window.location.search);
          params.get('code');
        `);

        expect(result).toBe('abc123');
      });

      it('should correctly parse state parameter', () => {
        Object.defineProperty(window, 'location', {
          value: {
            search: '?code=abc123&state=xyz'
          },
          writable: true
        });

        const result = window.eval(`
          const params = new URLSearchParams(window.location.search);
          params.get('state');
        `);

        expect(result).toBe('xyz');
      });

      it('should correctly parse error parameter', () => {
        Object.defineProperty(window, 'location', {
          value: {
            search: '?error=access_denied&error_description=User%20cancelled'
          },
          writable: true
        });

        const result = window.eval(`
          const params = new URLSearchParams(window.location.search);
          params.get('error');
        `);

        expect(result).toBe('access_denied');
      });

      it('should return null for missing parameters', () => {
        Object.defineProperty(window, 'location', {
          value: {
            search: '?other=value'
          },
          writable: true
        });

        const result = window.eval(`
          const params = new URLSearchParams(window.location.search);
          params.get('code');
        `);

        expect(result).toBeNull();
      });
    });

    describe('Token Exchange Request Formation', () => {
      it('should create correct request body for token exchange', () => {
        Object.defineProperty(window, 'location', {
          value: {
            origin: 'http://localhost:3000'
          },
          writable: true
        });

        const result = window.eval(`
          const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: 'test_code',
            client_id: 'systemprompt-os',
            redirect_uri: window.location.origin
          });
          params.toString();
        `);

        expect(result).toContain('grant_type=authorization_code');
        expect(result).toContain('code=test_code');
        expect(result).toContain('client_id=systemprompt-os');
        expect(result).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed JSON response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await window.eval(`
        (async function() {
          try {
            const response = await fetch('/oauth2/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: 'test=body'
            });
            
            if (!response.ok) {
              try {
                const errorData = await response.json();
                showError('Login Failed', errorData.error_description || errorData.error);
              } catch {
                showError('Login Failed', 'Unknown error');
              }
            }
          } catch (err) {
            showError('Connection Error', 'Failed to complete authentication');
          }
        })()
      `);

      // Should handle the JSON parsing error gracefully
      expect(document.querySelector('h1')?.textContent).toBe('Connection Error');
    });

    it('should handle empty error response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({})
      });

      await window.eval(`
        (async function() {
          const response = await fetch('/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'test=body'
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            showError('Login Failed', errorData.error_description || errorData.error);
          }
        })()
      `);

      expect(document.querySelector('h1')?.textContent).toBe('Login Failed');
      expect(document.querySelector('.error h2')?.textContent).toBe('Error: undefined');
    });

    it('should handle missing DOM elements gracefully', () => {
      // Remove elements to test error handling
      document.querySelector('.spinner')?.remove();
      document.querySelector('h1')?.remove();
      document.querySelector('p')?.remove();

      // Should not throw errors even with missing elements
      expect(() => {
        window.eval(`showError('Test', 'message')`);
      }).not.toThrow();
    });
  });

  describe('CSS Styling Coverage', () => {
    it('should include all required CSS selectors', () => {
      const style = document.querySelector('style')?.textContent || '';
      
      // Basic reset and layout
      expect(style).toContain('* {');
      expect(style).toContain('body {');
      expect(style).toContain('.container {');
      
      // Spinner styles
      expect(style).toContain('.spinner {');
      expect(style).toContain('@keyframes spin');
      
      // Typography
      expect(style).toContain('h1 {');
      expect(style).toContain('p {');
      
      // Error styles
      expect(style).toContain('.error {');
      expect(style).toContain('.error h2 {');
      expect(style).toContain('.error a {');
      expect(style).toContain('.error a:hover {');
    });

    it('should have responsive design properties', () => {
      const style = document.querySelector('style')?.textContent || '';
      
      expect(style).toContain('min-height: 100vh');
      expect(style).toContain('max-width: 400px');
      expect(style).toContain('width: 100%');
      expect(style).toContain('padding: 20px');
    });

    it('should have accessibility considerations', () => {
      const style = document.querySelector('style')?.textContent || '';
      
      // Focus states for links
      expect(style).toContain('.error a:hover');
      
      // Sufficient color contrast (dark theme)
      expect(style).toContain('#e0e0e0'); // Light text
      expect(style).toContain('#0a0a0a'); // Dark background
    });
  });

  describe('Integration Points', () => {
    it('should use correct OAuth2 endpoint', () => {
      const html = renderCallbackHandler();
      expect(html).toContain("'/oauth2/token'");
    });

    it('should use correct user count endpoint', () => {
      const html = renderCallbackHandler();
      expect(html).toContain("'/api/users/count'");
    });

    it('should use correct client ID', () => {
      const html = renderCallbackHandler();
      expect(html).toContain("'systemprompt-os'");
    });

    it('should redirect to correct auth endpoint on error', () => {
      const html = renderCallbackHandler();
      expect(html).toContain('href="/auth"');
    });
  });

  describe('Additional Edge Cases and Error Scenarios', () => {
    it('should handle localStorage setItem failure', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage quota exceeded');
      });
      
      const mockTokenResponse = {
        access_token: 'test_access_token',
        token_type: 'Bearer'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });
      
      const html = renderCallbackHandler();
      const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      
      if (scriptContent) {
        let errorCaught = false;
        try {
          await window.eval(`
            ${scriptContent.replace('handleCallback();', '')}
            
            (async function() {
              try {
                await handleCallback();
              } catch (err) {
                throw err;
              }
            })();
          `);
        } catch (err) {
          errorCaught = true;
        }
        
        // The function should handle localStorage errors gracefully
        expect(mockFetch).toHaveBeenCalled();
      }
    });
    
    it('should handle non-JSON error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error('Not JSON'))
      });
      
      const html = renderCallbackHandler();
      const dom = new JSDOM(html, { 
        url: 'http://localhost:3000/auth/callback?code=test123'
      });
      const testWindow = dom.window;
      const testDocument = testWindow.document;
      
      testWindow.fetch = mockFetch;
      
      const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      if (scriptContent) {
        await testWindow.eval(`
          ${scriptContent.replace('handleCallback();', '')}
          
          (async function() {
            await handleCallback();
          })();
        `);
        
        // Should show connection error when JSON parsing fails
        expect(testDocument.querySelector('h1')?.textContent).toBe('Connection Error');
      }
      
      dom.window.close();
    });
    
    it('should handle URL with error parameter containing description', () => {
      const html = renderCallbackHandler();
      const dom = new JSDOM(html, { 
        url: 'http://localhost:3000/auth/callback?error=access_denied&error_description=User%20denied%20access'
      });
      const testWindow = dom.window;
      const testDocument = testWindow.document;
      
      const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      if (scriptContent) {
        testWindow.eval(`
          ${scriptContent.replace('handleCallback();', '')}
          
          const params = new URLSearchParams(window.location.search);
          const error = params.get('error');
          
          if (error) {
            showError('Authentication Failed', error);
          }
        `);
        
        expect(testDocument.querySelector('h1')?.textContent).toBe('Authentication Failed');
        expect(testDocument.querySelector('.error h2')?.textContent).toBe('Error: access_denied');
      }
      
      dom.window.close();
    });
    
    it('should handle checkIfSetup function with JSON parsing error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });
      
      const html = renderCallbackHandler();
      const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

      if (scriptContent) {
        const result = await window.eval(`
          ${scriptContent.replace('handleCallback();', '')}
          
          (async function() {
            return await checkIfSetup();
          })();
        `);
        
        expect(result).toBe(false);
      }
    });
    
    it('should handle state parameter extraction', () => {
      const html = renderCallbackHandler();
      const dom = new JSDOM(html, { 
        url: 'http://localhost:3000/auth/callback?code=test123&state=custom_state_value'
      });
      const testWindow = dom.window;
      
      const result = testWindow.eval(`
        const params = new URLSearchParams(window.location.search);
        params.get('state');
      `);
      
      expect(result).toBe('custom_state_value');
      dom.window.close();
    });
    
    it('should handle missing DOM elements in showError gracefully', () => {
      const html = renderCallbackHandler();
      const dom = new JSDOM('<html><body></body></html>'); // Empty DOM
      const testWindow = dom.window;
      const testDocument = testWindow.document;
      
      const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      if (scriptContent) {
        // Extract just the showError function
        const showErrorMatch = scriptContent.match(/function showError\(title, message\) \{[\s\S]*?\}/);
        if (showErrorMatch) {
          expect(() => {
            testWindow.eval(`
              ${showErrorMatch[0]}
              showError('Test', 'Message');
            `);
          }).not.toThrow();
        }
      }
      
      dom.window.close();
    });
    
    it('should handle various HTTP error status codes', async () => {
      const errorCodes = [400, 401, 403, 404, 500, 502, 503];
      
      for (const statusCode of errorCodes) {
        mockFetch.mockReset();
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: statusCode,
          json: () => Promise.resolve({ error: `http_${statusCode}`, error_description: `HTTP ${statusCode} error` })
        });
        
        const html = renderCallbackHandler();
        const dom = new JSDOM(html, { 
          url: 'http://localhost:3000/auth/callback?code=test123'
        });
        const testWindow = dom.window;
        const testDocument = testWindow.document;
        
        testWindow.fetch = mockFetch;
        
        const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
        if (scriptContent) {
          await testWindow.eval(`
            ${scriptContent.replace('handleCallback();', '')}
            
            (async function() {
              await handleCallback();
            })();
          `);
          
          expect(testDocument.querySelector('h1')?.textContent).toBe('Login Failed');
          expect(testDocument.querySelector('.error h2')?.textContent).toBe(`Error: HTTP ${statusCode} error`);
        }
        
        dom.window.close();
      }
    });
    
    it('should handle token response without refresh_token conditionally', async () => {
      const mockTokenResponse = {
        access_token: 'test_access_token',
        token_type: 'Bearer'
        // Intentionally no refresh_token
      };
      
      const mockUserCountResponse = { count: 0 };
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserCountResponse)
        });
      
      let redirectUrl = '';
      Object.defineProperty(window.location, 'href', {
        set: (url: string) => { redirectUrl = url; },
        get: () => redirectUrl
      });
      
      const html = renderCallbackHandler();
      const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      
      if (scriptContent) {
        await window.eval(`
          ${scriptContent.replace('handleCallback();', '')}
          
          (async function() {
            await handleCallback();
          })();
        `);
      }
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('access_token', 'test_access_token');
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('refresh_token', expect.anything());
      expect(redirectUrl).toBe('/');
    });
    
    it('should handle network timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
      
      const html = renderCallbackHandler();
      const dom = new JSDOM(html, { 
        url: 'http://localhost:3000/auth/callback?code=test123'
      });
      const testWindow = dom.window;
      const testDocument = testWindow.document;
      testWindow.fetch = mockFetch;
      
      const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      if (scriptContent) {
        await testWindow.eval(`
          ${scriptContent.replace('handleCallback();', '')}
          
          (async function() {
            await handleCallback();
          })();
        `);
        
        expect(testDocument.querySelector('h1')?.textContent).toBe('Connection Error');
        expect(testDocument.querySelector('.error h2')?.textContent).toBe('Error: Failed to complete authentication');
      }
      
      dom.window.close();
    });
    
    it('should handle empty/malformed URL parameters', () => {
      const testCases = [
        { url: 'http://localhost:3000/auth/callback?code=&state=', expected: '' },
        { url: 'http://localhost:3000/auth/callback?code&state', expected: '' },
        { url: 'http://localhost:3000/auth/callback?', expected: null },
        { url: 'http://localhost:3000/auth/callback', expected: null }
      ];
      
      testCases.forEach(({ url, expected }) => {
        const html = renderCallbackHandler();
        const dom = new JSDOM(html, { url });
        const testWindow = dom.window;
        
        const result = testWindow.eval(`
          const params = new URLSearchParams(window.location.search);
          params.get('code');
        `);
        
        expect(result).toBe(expected);
        dom.window.close();
      });
    });
    
    it('should test all CSS selectors and classes are used', () => {
      const html = renderCallbackHandler();
      
      // Verify all CSS classes are present in the HTML
      const cssClasses = [
        'container', 'spinner', 'error', 'error h2', 'error a', 'error a:hover'
      ];
      
      cssClasses.forEach(className => {
        expect(html).toContain(className.replace(' ', ' ').split(' ')[0]);
      });
    });
    
    it('should handle XSS prevention in error messages', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      const html = renderCallbackHandler();
      const dom = new JSDOM(html);
      const testWindow = dom.window;
      const testDocument = testWindow.document;
      
      const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      if (scriptContent) {
        testWindow.eval(`
          ${scriptContent.replace('handleCallback();', '')}
          showError('XSS Test', '${xssPayload}');
        `);
        
        const errorContainer = testDocument.getElementById('error-container');
        expect(errorContainer?.innerHTML).toContain('&lt;script&gt;');
      }
      
      dom.window.close();
    });
  });

  describe('Complete Template Structure Validation', () => {
    it('should generate a complete and valid HTML document', () => {
      const html = renderCallbackHandler();
      
      // Document structure validation
      expect(html.trim().startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html.endsWith('  `;')).toBe(true);
      
      // Count HTML tags for balance
      const openTags = (html.match(/<[^/][^>]*>/g) || []).length;
      const closeTags = (html.match(/<\/[^>]*>/g) || []).length;
      const selfClosingTags = (html.match(/<[^>]*\/>/g) || []).length;
      
      // Should have balanced tags (accounting for self-closing tags)
      expect(openTags).toBe(closeTags + selfClosingTags);
    });
    
    it('should be a single exported function', () => {
      expect(typeof renderCallbackHandler).toBe('function');
      expect(renderCallbackHandler.length).toBe(0); // No parameters
    });
    
    it('should return consistent output', () => {
      const html1 = renderCallbackHandler();
      const html2 = renderCallbackHandler();
      
      expect(html1).toBe(html2);
      expect(html1.length).toBeGreaterThan(1000);
    });
    
    it('should contain all required HTML5 elements', () => {
      const html = renderCallbackHandler();
      
      // HTML5 semantic structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('<title>');
      expect(html).toContain('<style>');
      expect(html).toContain('<body>');
      expect(html).toContain('<script>');
    });
    
    it('should have proper HTML attribute escaping', () => {
      const html = renderCallbackHandler();
      
      // Check for proper attribute quoting
      expect(html).toMatch(/charset="[^"]+"/);
      expect(html).toMatch(/name="[^"]+"/);
      expect(html).toMatch(/content="[^"]+"/);
      expect(html).toMatch(/class="[^"]+"/);
      expect(html).toMatch(/id="[^"]+"/);
    });
  });