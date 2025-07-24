/**
 * @fileoverview OAuth callback handling template
 * @module server/external/templates/auth/callback
 */

/**
 * Renders the OAuth callback handler page
 *
 * This page automatically exchanges the authorization code for tokens
 * and completes the login process.
 */
export function renderCallbackHandler(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Completing Login - SystemPrompt OS</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0a0a0a;
          color: #e0e0e0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: #1a1a1a;
          border-radius: 16px;
          padding: 48px;
          max-width: 400px;
          width: 100%;
          text-align: center;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          border: 1px solid #2a2a2a;
        }
        .spinner {
          width: 48px;
          height: 48px;
          margin: 0 auto 24px;
          border: 3px solid #2a2a2a;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        h1 {
          font-size: 24px;
          margin-bottom: 16px;
          color: #f1f5f9;
        }
        p {
          color: #9ca3af;
          margin-bottom: 8px;
        }
        .error {
          background: #991b1b;
          color: #fef2f2;
          padding: 16px;
          border-radius: 8px;
          margin-top: 24px;
        }
        .error h2 {
          font-size: 18px;
          margin-bottom: 8px;
        }
        .error a {
          color: #fbbf24;
          text-decoration: none;
        }
        .error a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h1>Completing Login</h1>
        <p>Please wait while we complete your authentication...</p>
        <div id="error-container"></div>
      </div>

      <script>
        async function handleCallback() {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          const state = params.get('state');
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
            // Exchange code for tokens
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
            
            // Store tokens in localStorage
            localStorage.setItem('access_token', tokens.access_token);
            if (tokens.refresh_token) {
              localStorage.setItem('refresh_token', tokens.refresh_token);
            }

            // Redirect based on whether this was initial setup
            const isSetup = await checkIfSetup();
            window.location.href = isSetup ? '/config' : '/';
            
          } catch (err) {
            showError('Connection Error', 'Failed to complete authentication');
          }
        }

        async function checkIfSetup() {
          try {
            const response = await fetch('/api/users/count');
            const data = await response.json();
            return data.count === 1;
          } catch {
            return false;
          }
        }

        function showError(title, message) {
          document.querySelector('.spinner').style.display = 'none';
          document.querySelector('h1').textContent = title;
          document.querySelector('p').style.display = 'none';
          
          const errorContainer = document.getElementById('error-container');
          errorContainer.innerHTML = \`
            <div class="error">
              <h2>Error: \${message}</h2>
              <p><a href="/auth">Try again</a></p>
            </div>
          \`;
        }

        // Start the callback handling
        handleCallback();
      </script>
    </body>
    </html>
  `;
}