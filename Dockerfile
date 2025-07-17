FROM node:18-alpine

# Install necessary packages
# Note: coreutils is needed for full 'env' command support (npx uses env -S)
RUN apk add --no-cache tini git bash curl coreutils

# Create app user and group (use node user if conflicts)
RUN addgroup -S appgroup || true && \
    adduser -S appuser -G appgroup || true

# Create necessary directories with proper permissions
# Include custom code directories that will be mounted or linked
RUN mkdir -p /app /data/state /data/projects \
    /app/modules/custom \
    /app/server/mcp/custom \
    /app/custom-modules \
    /app/custom-mcp && \
    chown -R appuser:appgroup /app /data

WORKDIR /app

# Copy package files as root
COPY package*.json ./

# Install dependencies as root (for native modules)
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Copy application files
COPY . .

# Copy and set permissions for entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Build the application
RUN npm run build

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