#!/bin/bash
# Test database CLI commands in Docker

echo "=== Testing Database CLI in Docker Container ==="
echo ""

# Build the image
echo "1. Building Docker image..."
docker build -t systemprompt-os:test . || exit 1

# Run a container with a volume for persistent state
CONTAINER_NAME="systemprompt-test-$$"
echo ""
echo "2. Starting test container: $CONTAINER_NAME"
docker run -d --name "$CONTAINER_NAME" \
  -e DATABASE_FILE=/data/state/database.db \
  -v systemprompt-test-state:/data/state \
  systemprompt-os:test \
  tail -f /dev/null

# Function to run commands in the container
run_in_container() {
  docker exec "$CONTAINER_NAME" systemprompt "$@"
}

echo ""
echo "3. Testing database:status (uninitialized)"
run_in_container database:status || echo "Expected: Database not initialized"

echo ""
echo "4. Initializing database schema"
run_in_container database:schema --action=init

echo ""
echo "5. Testing database:status (initialized)"
run_in_container database:status

echo ""
echo "6. Testing database:schema --action=list"
run_in_container database:schema --action=list

echo ""
echo "7. Testing database:migrate"
run_in_container database:migrate

echo ""
echo "8. Testing database:query with SELECT"
run_in_container database:query --sql "SELECT name FROM sqlite_master WHERE type='table'"

echo ""
echo "9. Testing database:query with CREATE TABLE"
run_in_container database:query --sql "CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)" --readonly=false

echo ""
echo "10. Testing database:query with INSERT"
run_in_container database:query --sql "INSERT INTO test_table (name) VALUES ('Docker Test')" --readonly=false

echo ""
echo "11. Testing database:query with SELECT (JSON format)"
run_in_container database:query --sql "SELECT * FROM test_table" --format=json

echo ""
echo "12. Cleanup"
docker stop "$CONTAINER_NAME" > /dev/null
docker rm "$CONTAINER_NAME" > /dev/null
docker volume rm systemprompt-test-state > /dev/null 2>&1

echo ""
echo "=== All tests completed ==="