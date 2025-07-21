#!/bin/bash

# E2E Tunnel Test Runner
# This script sets up and tests the cloudflared tunnel with Docker

set -e

echo "=== SystemPrompt OS - Cloudflared Tunnel E2E Test ==="
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker to run this test."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed. Please install docker-compose to run this test."
    exit 1
fi

# Check for required environment variables
if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo "Warning: CLOUDFLARE_TUNNEL_TOKEN not set. Using mock token for testing."
    export CLOUDFLARE_TUNNEL_TOKEN="mock-tunnel-token"
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Clean up function
cleanup() {
    echo
    echo "Cleaning up..."
    docker-compose -f docker-compose.test.yml down -v --remove-orphans
    echo "Cleanup complete."
}

# Set up trap to ensure cleanup on exit
trap cleanup EXIT INT TERM

echo "1. Starting Docker containers..."
docker-compose -f docker-compose.test.yml up -d

echo
echo "2. Waiting for services to be ready..."
sleep 10

echo
echo "3. Checking container status..."
docker-compose -f docker-compose.test.yml ps

echo
echo "4. Checking cloudflared logs..."
docker-compose -f docker-compose.test.yml logs cloudflared-tunnel | tail -20

echo
echo "5. Testing mock OAuth provider health..."
curl -s http://localhost:4567/health | jq . || echo "Failed to reach mock OAuth provider"

echo
echo "6. Running the E2E test..."
cd ../../..
npm test -- tests/e2e/tunnel/cloudflared-tunnel.spec.ts

echo
echo "=== Test Complete ==="

# The cleanup function will be called automatically