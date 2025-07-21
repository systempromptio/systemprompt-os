FROM node:18-alpine

# Install necessary packages
# Note: coreutils is needed for full 'env' command support (npx uses env -S)
RUN apk add --no-cache tini git bash curl coreutils wget

# Install cloudflared for OAuth tunnel support
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

# Create app user and group (use node user if conflicts)
RUN addgroup -S appgroup || true && \
    adduser -S appuser -G appgroup || true

# Create necessary directories with proper permissions
# Include custom code directories that will be mounted or linked
RUN mkdir -p /app /data/state /data/projects \
    /data/state/tasks /data/state/sessions /data/state/logs /data/state/reports \
    /app/modules/custom \
    /app/server/mcp/custom \
    /app/custom-modules \
    /app/custom-mcp && \
    chown -R appuser:appgroup /app /data && \
    chmod -R 775 /data/state

WORKDIR /app

# Copy package files as root
COPY package*.json ./

# Install dependencies as root (for native modules)
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Rebuild native modules for the container architecture
RUN npm rebuild better-sqlite3

# Copy application files
COPY . .

# Copy and set permissions for entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Build the application
RUN npm run build:main

# Copy non-TypeScript resource files to build directory for runtime access
RUN find /app/src/modules -type f \( -name "*.yaml" -o -name "*.yml" -o -name "*.sql" -o -name "*.json" \) -exec bash -c 'mkdir -p "/app/build/modules/$(dirname "${1#/app/src/modules/}")" && cp "$1" "/app/build/modules/${1#/app/src/modules/}"' _ {} \;

# Make the CLI globally available by creating a symlink in /usr/local/bin
RUN chmod +x /app/bin/systemprompt && \
    ln -s /app/bin/systemprompt /usr/local/bin/systemprompt

# Handle custom code directories
# Create placeholder files to ensure directories exist even if not mounted
RUN touch /app/modules/custom/.gitkeep \
    /app/server/mcp/custom/.gitkeep && \
    echo '# Custom Modules\nPlace custom modules here or mount via volume' > /app/modules/custom/README.md && \
    echo '# Custom MCP Servers\nPlace custom MCP servers here or mount via volume' > /app/server/mcp/custom/README.md

# Change ownership of app files
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
ARG PORT=3000
EXPOSE ${PORT}

# Use tini and our entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

# Run the application
CMD ["node", "build/index.js"]