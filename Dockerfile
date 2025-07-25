FROM node:20-alpine

# Install necessary packages
RUN apk add --no-cache tini git bash curl coreutils wget sqlite

# Install cloudflared for OAuth tunnel support
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

# Create app user and group with specific UID/GID for consistency
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Create necessary directories with proper permissions
RUN mkdir -p /app /data/state /data/projects \
    /data/state/tasks /data/state/sessions /data/state/logs /data/state/reports \
    /data/state/auth /data/state/auth/keys \
    /app/logs && \
    chown -R appuser:appgroup /app /data && \
    chmod -R 755 /data && \
    chmod -R 755 /app/logs && \
    chmod 700 /data/state/auth/keys

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (keep all for tsx to work)
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Rebuild native modules for the container architecture
RUN npm rebuild better-sqlite3

# Copy application files
COPY . .

# Make the CLI globally available
RUN chmod +x /app/bin/systemprompt && \
    ln -s /app/bin/systemprompt /usr/local/bin/systemprompt

# Copy and set permissions for entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Change ownership of app files
RUN chown -R appuser:appgroup /app && \
    chown -R appuser:appgroup /data

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

# Default command - use tsx to run directly
CMD ["npx", "tsx", "src/index.ts"]