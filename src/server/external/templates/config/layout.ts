/**
 * Configuration for page layout rendering.
 */
export interface LayoutConfig {
  title: string;
  content: string;
  styles?: string;
}

/**
 * Renders the base HTML layout for configuration pages.
 * @param config
 */
export function renderLayout(config: LayoutConfig): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${config.title} - SystemPrompt OS</title>
      <style>${getBaseStyles()}${config.styles || ''}</style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        ${config.content}
      </div>
    </body>
    </html>
  `;
}

/**
 * Returns base CSS styles shared across all configuration pages.
 */
function getBaseStyles(): string {
  return `
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
      max-width: 600px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      border: 1px solid #2a2a2a;
    }
    .logo {
      text-align: center;
      margin-bottom: 32px;
    }
    .logo svg {
      width: 72px;
      height: 72px;
      fill: #3b82f6;
    }
    h1 {
      text-align: center;
      margin-bottom: 12px;
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      text-align: center;
      color: #9ca3af;
      margin-bottom: 48px;
      font-size: 18px;
      line-height: 1.5;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      color: #6b7280;
      font-size: 14px;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  `;
}
