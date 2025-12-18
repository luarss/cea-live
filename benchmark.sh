#!/bin/bash

set -e

RESULTS_DIR="/app/benchmark-results"
RESULTS_FILE="$RESULTS_DIR/benchmark-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$RESULTS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to get memory usage in MB
get_memory_mb() {
    local pid=$1
    if [ -z "$pid" ]; then
        echo "0"
        return
    fi
    ps -p $pid -o rss= 2>/dev/null | awk '{print int($1/1024)}' || echo "0"
}

# Function to get total container memory usage
get_container_memory() {
    awk '/MemTotal/ {total=$2} /MemAvailable/ {avail=$2} END {used=total-avail; print int(used/1024)}' /proc/meminfo
}

# Function to log with timestamp
log() {
    local msg="$1"
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $msg" | tee -a "$RESULTS_FILE"
}

# Function to log memory usage
log_memory() {
    local phase="$1"
    local pid="$2"
    local proc_mem=$(get_memory_mb "$pid")
    local container_mem=$(get_container_memory)
    log "${BLUE}[MEMORY] $phase - Process: ${proc_mem}MB | Container Total: ${container_mem}MB / 512MB${NC}"
}

# Function to monitor process memory
monitor_memory() {
    local pid=$1
    local phase=$2
    local max_mem=0

    while kill -0 $pid 2>/dev/null; do
        local current_mem=$(get_memory_mb "$pid")
        if [ "$current_mem" -gt "$max_mem" ]; then
            max_mem=$current_mem
        fi
        sleep 2
    done

    log "${BLUE}[MEMORY] $phase - Peak Memory: ${max_mem}MB${NC}"
    echo $max_mem
}

log "${GREEN}============================================================${NC}"
log "${GREEN}CEA-VIZ 512MB Memory Benchmark${NC}"
log "${GREEN}============================================================${NC}"
log "Container Memory Limit: 512MB"
log "Container CPU Limit: 0.1 CPU"
log ""

# Track overall success
OVERALL_SUCCESS=true

# Phase 1: Verify Database
log "${YELLOW}[PHASE 1] Verifying Pre-built Database${NC}"
log_memory "Initial State" ""

if [ -f "/app/data/processed/cea-transactions.db" ]; then
    DB_SIZE=$(du -h /app/data/processed/cea-transactions.db | cut -f1)
    log "${GREEN}[SUCCESS] Database found: ${DB_SIZE}${NC}"
    PIPELINE_PEAK=0
    MIGRATE_PEAK=0
else
    log "${RED}[ERROR] Database not found${NC}"
    OVERALL_SUCCESS=false
    exit 1
fi

sleep 2

# Phase 2: Frontend Build
log ""
log "${YELLOW}[PHASE 3] Building Frontend${NC}"
log_memory "Before Frontend Build" ""

cd /app/frontend
npm run build &
BUILD_PID=$!

# Monitor build in background
(monitor_memory $BUILD_PID "Frontend Build") > /tmp/build_mem &
MONITOR_PID=$!

# Wait for build to complete
if wait $BUILD_PID; then
    wait $MONITOR_PID
    BUILD_PEAK=$(cat /tmp/build_mem)
    log "${GREEN}[SUCCESS] Frontend build completed${NC}"
    log_memory "After Frontend Build" ""

    # Check if dist folder was created
    if [ -d "/app/frontend/dist" ]; then
        DIST_SIZE=$(du -sh /app/frontend/dist | cut -f1)
        log "${GREEN}[SUCCESS] Frontend dist created: ${DIST_SIZE}${NC}"
    else
        log "${RED}[ERROR] Frontend dist not found${NC}"
        OVERALL_SUCCESS=false
    fi
else
    log "${RED}[ERROR] Frontend build failed${NC}"
    OVERALL_SUCCESS=false
    exit 1
fi

sleep 5

# Phase 3: Server Start & Load Testing
log ""
log "${YELLOW}[PHASE 3] Starting Server${NC}"
log_memory "Before Server Start" ""

cd /app/backend
node src/server.js > /tmp/server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 10

if kill -0 $SERVER_PID 2>/dev/null; then
    log "${GREEN}[SUCCESS] Server started${NC}"
    log_memory "Server Running" "$SERVER_PID"

    # Phase 3a: Run concurrent load test
    log ""
    log "${YELLOW}[PHASE 3a] Running Concurrent Load Test${NC}"
    log "${BLUE}[INFO] Testing API performance under load...${NC}"

    # Monitor memory during load test in background
    (
        MAX_MEM=0
        while kill -0 $SERVER_PID 2>/dev/null; do
            CURRENT_MEM=$(get_memory_mb "$SERVER_PID")
            if [ "$CURRENT_MEM" -gt "$MAX_MEM" ]; then
                MAX_MEM=$CURRENT_MEM
            fi
            sleep 1
        done
        echo $MAX_MEM > /tmp/loadtest_peak_mem
    ) &
    MONITOR_PID=$!

    # Run load test
    if npm run load-test > /app/benchmark-results/load-test-output.log 2>&1; then
        log "${GREEN}[SUCCESS] Load test completed${NC}"

        # Extract key metrics from load test output
        if grep -q "Final Assessment" /app/benchmark-results/load-test-output.log; then
            log "${BLUE}[LOAD TEST] Extracting performance metrics...${NC}"

            # Count endpoints meeting target
            PASS_COUNT=$(grep -c "p99.*ms" /app/benchmark-results/load-test-output.log | head -1 || echo "0")

            # Check cache performance
            CACHE_HIT_RATE=$(grep "Hit Rate:" /app/benchmark-results/load-test-output.log | head -1 | awk '{print $3}' || echo "N/A")

            log "${GREEN}[LOAD TEST] Cache Hit Rate: ${CACHE_HIT_RATE}${NC}"

            # Copy full results for later review
            cp /app/benchmark-results/load-test-output.log "$RESULTS_DIR/load-test-results.txt"

            # Show summary
            log "${BLUE}[LOAD TEST] Top 5 fastest endpoints (p99):${NC}"
            grep "ms" /app/benchmark-results/load-test-output.log | grep -E "^\d+\." | head -5 | while read line; do
                log "  $line"
            done
        fi

        # Get peak memory during load test
        kill $MONITOR_PID 2>/dev/null || true
        wait $MONITOR_PID 2>/dev/null || true

        if [ -f /tmp/loadtest_peak_mem ]; then
            LOADTEST_PEAK=$(cat /tmp/loadtest_peak_mem)
            log "${BLUE}[MEMORY] Load Test - Peak Memory: ${LOADTEST_PEAK}MB${NC}"
            MAX_SERVER_MEM=$LOADTEST_PEAK
        else
            MAX_SERVER_MEM=$(get_memory_mb "$SERVER_PID")
            log "${BLUE}[MEMORY] Load Test - Final Memory: ${MAX_SERVER_MEM}MB${NC}"
        fi
    else
        log "${RED}[ERROR] Load test failed${NC}"
        log "${YELLOW}[INFO] Check /app/benchmark-results/load-test-output.log for details${NC}"
        OVERALL_SUCCESS=false
    fi

    # Kill server
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
else
    log "${RED}[ERROR] Server failed to start${NC}"
    OVERALL_SUCCESS=false
fi

# Final Summary
log ""
log "${GREEN}============================================================${NC}"
log "${GREEN}BENCHMARK SUMMARY${NC}"
log "${GREEN}============================================================${NC}"
log ""
log "Memory Usage by Phase:"
log "  - Frontend Build:     ${BUILD_PEAK}MB"
log "  - Server Runtime:     ${MAX_SERVER_MEM}MB"
log "  - Peak Under Load:    ${MAX_SERVER_MEM}MB"
log ""

# Calculate if we're safe
MAX_OVERALL=$PIPELINE_PEAK
[ "$MIGRATE_PEAK" -gt "$MAX_OVERALL" ] && MAX_OVERALL=$MIGRATE_PEAK
[ "$BUILD_PEAK" -gt "$MAX_OVERALL" ] && MAX_OVERALL=$BUILD_PEAK
[ "$MAX_SERVER_MEM" -gt "$MAX_OVERALL" ] && MAX_OVERALL=$MAX_SERVER_MEM

log "Peak Memory Usage: ${MAX_OVERALL}MB / 512MB"
log "Memory Headroom: $((512 - MAX_OVERALL))MB"
log ""

# Final verdict
if [ "$OVERALL_SUCCESS" = true ]; then
    if [ "$MAX_OVERALL" -lt 450 ]; then
        log "${GREEN}✓ PASS: Application runs comfortably within 512MB${NC}"
        log "${GREEN}✓ Safe to deploy to Render free tier${NC}"
    elif [ "$MAX_OVERALL" -lt 490 ]; then
        log "${YELLOW}⚠ CAUTION: Application uses most of 512MB${NC}"
        log "${YELLOW}⚠ May fail under load or with slightly more data${NC}"
        log "${YELLOW}⚠ Consider optimizations or paid tier${NC}"
    else
        log "${RED}✗ FAIL: Application uses too much memory${NC}"
        log "${RED}✗ Likely to fail on Render free tier${NC}"
        log "${RED}✗ Need optimizations or paid tier${NC}"
        OVERALL_SUCCESS=false
    fi
else
    log "${RED}✗ FAIL: One or more phases failed${NC}"
    log "${RED}✗ Cannot deploy to Render free tier${NC}"
fi

log ""
log "${GREEN}============================================================${NC}"
log "Benchmark complete. Results saved to: $RESULTS_FILE"
log "${GREEN}============================================================${NC}"

# Exit with appropriate code
if [ "$OVERALL_SUCCESS" = true ]; then
    exit 0
else
    exit 1
fi
