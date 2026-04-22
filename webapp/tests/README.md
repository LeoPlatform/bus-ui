# Tests Directory

This directory contains all test files for the webapp project. The structure mirrors the source code organization for easy navigation and maintenance.

## Directory Structure

```
tests/
├── README.md                    # This file
├── lib/                         # Tests for src/lib/
│   ├── bucketUtils.test.ts      # Tests for bucketUtils.ts
│   ├── bucketUtils.test.md      # Documentation for bucketUtils tests
│   ├── server/                  # Tests for src/lib/server/
│   ├── client/                  # Tests for src/lib/client/
│   ├── stats/                   # Tests for src/lib/stats/
│   ├── stores/                  # Tests for src/lib/stores/
│   ├── auth/                    # Tests for src/lib/auth/
│   └── types/                   # Tests for src/lib/types/
└── routes/                      # Tests for src/routes/
```

## Test File Naming Conventions

- **Unit tests**: `*.test.ts` or `*.spec.ts`
- **Integration tests**: `*.integration.test.ts`
- **E2E tests**: `*.e2e.test.ts`
- **Documentation**: `*.test.md` or `*.spec.md`

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/lib/bucketUtils.test.ts

# Run tests in a specific directory
npm test -- tests/lib/

# Run with coverage
npm test -- --coverage
```

## Test Organization

### Unit Tests
- Located in `tests/lib/` for library functions
- Located in `tests/routes/` for route handlers
- Test individual functions and components in isolation

### Integration Tests
- Test interactions between multiple components
- Use `*.integration.test.ts` naming convention
- May require database or external service setup

### E2E Tests
- Test complete user workflows
- Use `*.e2e.test.ts` naming convention
- May require browser automation

## Test Conventions

1. **Describe blocks**: Group related tests by function or feature
2. **Test names**: Use descriptive names that explain the expected behavior
3. **Setup/Teardown**: Use `beforeEach` and `afterEach` for test isolation
4. **Mocking**: Mock external dependencies to ensure test isolation
5. **Assertions**: Use clear, specific assertions that explain the expected outcome

## Example Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { functionToTest } from '../../src/lib/functionToTest';

describe('functionToTest', () => {
  beforeEach(() => {
    // Setup for each test
  });

  describe('when given valid input', () => {
    it('should return expected result', () => {
      const result = functionToTest('valid input');
      expect(result).toBe('expected output');
    });
  });

  describe('when given invalid input', () => {
    it('should throw an error', () => {
      expect(() => functionToTest('invalid input')).toThrow();
    });
  });
});
```

## Coverage Goals

- **Unit tests**: 80%+ line coverage
- **Integration tests**: Cover critical user workflows
- **E2E tests**: Cover main user journeys

## Adding New Tests

1. Create test file in appropriate directory
2. Follow naming conventions
3. Write descriptive test cases
4. Ensure tests are isolated and repeatable
5. Update this README if adding new test types or conventions 