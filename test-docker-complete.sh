#!/bin/bash
set -e

echo "=== Complete Docker Test for SystemPrompt OS ==="
echo ""

# Build the image
echo "1. Building Docker image..."
docker build -t systemprompt-os:latest . || exit 1

# Test 1: Basic functionality without persistence
echo ""
echo "2. Testing basic functionality (no volume)..."
docker run --rm systemprompt-os:latest systemprompt --version
docker run --rm systemprompt-os:latest systemprompt --help | grep -q "database:status" && echo "✓ Database commands available"

# Test 2: Database commands with persistent volume
echo ""
echo "3. Testing with persistent volume..."
VOLUME_NAME="systemprompt-test-data"
docker volume create $VOLUME_NAME

# Run container with volume
echo "   Starting container with persistent volume..."
docker run --rm -v $VOLUME_NAME:/data/state systemprompt-os:latest systemprompt database:status

echo ""
echo "   Testing database queries..."
docker run --rm -v $VOLUME_NAME:/data/state systemprompt-os:latest \
    systemprompt database:query --sql "SELECT name FROM sqlite_master WHERE type='table'"

# Test 3: Cloudflare tunnel
echo ""
echo "4. Testing with Cloudflare tunnel (if token provided)..."
if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    docker run -d --name systemprompt-tunnel-test \
        -e CLOUDFLARE_TUNNEL_TOKEN="$CLOUDFLARE_TUNNEL_TOKEN" \
        -v $VOLUME_NAME:/data/state \
        systemprompt-os:latest
    
    echo "   Waiting for tunnel to establish..."
    sleep 10
    
    echo "   Container logs:"
    docker logs systemprompt-tunnel-test | grep -E "(Cloudflare|tunnel|URL)" || true
    
    # Check if the service is accessible
    docker exec systemprompt-tunnel-test curl -s http://localhost:3000/health || echo "Service not yet ready"
    
    # Cleanup
    docker stop systemprompt-tunnel-test
    docker rm systemprompt-tunnel-test
else
    echo "   Skipping tunnel test (no CLOUDFLARE_TUNNEL_TOKEN provided)"
fi

# Test 4: Full integration test
echo ""
echo "5. Running full integration test..."
docker run -d --name systemprompt-full-test \
    -p 3000:3000 \
    -v $VOLUME_NAME:/data/state \
    systemprompt-os:latest

echo "   Waiting for service to start..."
sleep 5

echo "   Testing database CLI commands..."
docker exec systemprompt-full-test systemprompt database:status
docker exec systemprompt-full-test systemprompt database:query --sql "CREATE TABLE docker_test (id INTEGER PRIMARY KEY, message TEXT)" --readonly=false
docker exec systemprompt-full-test systemprompt database:query --sql "INSERT INTO docker_test (message) VALUES ('Hello from Docker')" --readonly=false
docker exec systemprompt-full-test systemprompt database:query --sql "SELECT * FROM docker_test" --format=json

echo ""
echo "   Container health:"
docker exec systemprompt-full-test ps aux | grep -E "(node|cloudflared)" || true

# Cleanup
echo ""
echo "6. Cleaning up..."
docker stop systemprompt-full-test
docker rm systemprompt-full-test
docker volume rm $VOLUME_NAME

echo ""
echo "=== All tests completed successfully! ==="