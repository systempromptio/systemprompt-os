#!/bin/bash
set -e

echo "🔍 systemprompt-os Extension Validation"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

# Clean previous runs
echo -e "\n${YELLOW}Cleaning previous Docker images...${NC}"
docker rmi systemprompt-test systemprompt-os 2>/dev/null || true

# Step 1: Build and run tests in clean environment
echo -e "\n${YELLOW}Step 1: Building test Docker image...${NC}"
npm run docker:clean
print_status $? "Clean Docker test environment"

# Step 2: Build production image
echo -e "\n${YELLOW}Step 2: Building production Docker image...${NC}"
npm run docker:build
print_status $? "Production Docker build"

# Step 3: Run tests in production image
echo -e "\n${YELLOW}Step 3: Running tests in production image...${NC}"
npm run docker:test
print_status $? "All tests pass in production Docker"

# Step 4: Test the application can start
echo -e "\n${YELLOW}Step 4: Testing application startup...${NC}"
docker run -d --name systemprompt-test-run -p 3001:3000 systemprompt-os
sleep 5

# Check if container is running
if docker ps | grep -q systemprompt-test-run; then
    # Test health endpoint
    HTTP_STATUS=$(docker exec systemprompt-test-run wget -qO- -T 2 http://localhost:3000/health | head -c 100)
    if echo "$HTTP_STATUS" | grep -q "ok"; then
        print_status 0 "Application starts and responds to health checks"
    else
        print_status 1 "Health check failed"
    fi
else
    print_status 1 "Container failed to start"
fi

# Cleanup
docker stop systemprompt-test-run 2>/dev/null || true
docker rm systemprompt-test-run 2>/dev/null || true

echo -e "\n${GREEN}🎉 All validation checks passed!${NC}"
echo "Your extension is ready for integration."