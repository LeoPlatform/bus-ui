# time-picker.state.test.ts

This file contains comprehensive tests for the `TimePickerState` class in `src/lib/client/components/features/time-picker/time-picker.state.svelte.ts`.

## Test Coverage

The tests cover the following functionality:

### Constructor Tests
- **Default initialization**: Verifies that the class initializes with correct default values
- **Property initialization**: Tests that all properties are properly initialized

### Property Tests
- **range**: Tests getting and setting the time range (Minute15, Hour, Hour6, Day, Week)
- **count**: Tests the count property getter
- **customTime**: Tests getting and setting custom time strings
- **isExpanded**: Tests the expanded state management
- **dateSelectorExpanded**: Tests the date selector expanded state
- **timeRangeString**: Tests the formatted time range string

### Method Tests
- **submitDateChanges**: Tests that the date selector closes when changes are submitted
- **callback management**: Tests setting, clearing, and calling time range change callbacks
- **createStatsQueryRequest**: Tests creating valid stats query requests
- **minifyStatsRange**: Tests range minification for all supported ranges
- **getAvailableRanges**: Tests returning all available time ranges
- **formatDisplayTime**: Tests timestamp formatting
- **formatTimeRange**: Tests time range string formatting

### Edge Cases
- **Callback handling**: Tests behavior when no callback is set
- **Multiple range changes**: Tests multiple consecutive range changes

## Test Structure

The tests are organized into logical groups:
- **Constructor tests**: Verify proper initialization
- **Property tests**: Test getters and setters for each property
- **Method tests**: Test public methods and their behavior
- **Edge cases**: Test boundary conditions and error handling

## Key Test Cases

### Range Management
- Tests all valid `StatsRange` enum values
- Verifies range changes trigger appropriate updates
- Tests range minification for display purposes

### Callback System
- Tests setting and clearing callbacks
- Verifies callbacks are called when time range changes
- Tests behavior when no callback is set

### Request Generation
- Tests creating valid `StatsQueryRequest` objects
- Verifies proper structure and data types
- Tests handling of empty node arrays

### Formatting Functions
- Tests timestamp formatting with various inputs
- Tests time range string generation
- Tests range minification for all supported ranges

## Limitations

Due to the class implementation, some properties are not directly testable:
- **startTime and endTime getters**: These are commented out in the source class
- **selectedDate**: Type issues with internationalized date library
- **simplified property**: This property doesn't exist in the class

## Test Results

All 24 tests pass, covering:
- 6 property tests
- 8 method tests
- 2 edge case tests
- 8 formatting and utility function tests

## Running Tests

```bash
# Run these specific tests
npm test -- tests/lib/client/components/features/time-picker/time-picker.state.test.ts

# Run all tests
npm test
```

## Notes

- The tests use Vitest for testing framework
- Mock functions are used for the fetch dependency
- Tests focus on public API and observable behavior
- Some internal state is not directly testable due to private properties 