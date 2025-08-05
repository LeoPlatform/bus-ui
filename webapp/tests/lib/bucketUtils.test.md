# bucketUtils.test.ts

This file contains comprehensive tests for the `getStartAndEndOfBucket` function in `src/lib/bucketUtils.ts`.

## Test Coverage

The tests cover the following scenarios:

### Bucket Types
- **minute_1**: Tests 1-minute bucket alignment and boundaries
- **minute_5**: Tests 5-minute bucket alignment and boundaries  
- **minute_15**: Tests 15-minute bucket alignment and boundaries
- **hour**: Tests hour bucket alignment and boundaries
- **day**: Tests day bucket alignment and boundaries
- **week**: Tests week bucket alignment (week starts on Sunday)

### Test Scenarios
1. **Specific time tests**: Verify correct start/end times for given timestamps
2. **Current time tests**: Verify behavior when no time parameter is provided
3. **Boundary tests**: Test edge cases at minute/hour/day boundaries
4. **Alignment tests**: Verify proper alignment to bucket boundaries
5. **Edge cases**: Test zero timestamp, large timestamps, negative timestamps
6. **Function behavior**: Verify consistent return types and relationships

### Key Test Cases
- Zero timestamp handling (Unix epoch)
- Large timestamp handling (far future dates)
- Negative timestamp handling (past dates)
- Week boundary calculations (Sunday start)
- 5-minute and 15-minute alignment logic
- Current time fallback behavior

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/lib/bucketUtils.test.ts

# Run tests in watch mode
npm run test:watch

# Run with verbose output
npx vitest run src/lib/bucketUtils.test.ts --reporter=verbose
```

## Test Structure

The tests are organized into logical groups:
- **Bucket-specific tests**: Each bucket type has its own describe block
- **Edge cases**: Tests for boundary conditions and unusual inputs
- **Function behavior**: Tests for consistent return types and relationships

## Bug Fixes

During testing, a bug was discovered and fixed in the `getStartAndEndOfBucket` function:
- **Issue**: The function used `time ? new Date(time) : new Date()` which treated `0` as falsy
- **Fix**: Changed to `time !== undefined ? new Date(time) : new Date()` to properly handle zero timestamps

## Test Results

All 20 tests pass, covering:
- 6 bucket types × various scenarios
- 3 edge cases
- 3 function behavior tests
- Current time handling
- Boundary conditions 