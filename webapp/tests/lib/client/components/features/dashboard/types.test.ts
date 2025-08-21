import { describe, it, expect } from 'vitest';
import { parseDashboardTags, type DashboardTag } from '$comps/features/dashboard/types';

describe('parseDashboardTags', () => {
  describe('normal operation', () => {
    it('should parse a simple tag string with single key-value pairs', () => {
      const input = 'app:media-service,workflow:media,component:media-video-bot';
      const expected: DashboardTag = {
        app: 'media-service',
        workflow: 'media',
        component: 'media-video-bot'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should parse a single key-value pair', () => {
      const input = 'app:media-service';
      const expected: DashboardTag = {
        app: 'media-service'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle values containing colons', () => {
      const input = 'url:https://example.com:8080,path:/api/v1:endpoint';
      const expected: DashboardTag = {
        url: 'https://example.com:8080',
        path: '/api/v1:endpoint'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle empty values', () => {
      const input = 'key1:,key2:value2,key3:';
      const expected: DashboardTag = {
        key1: '',
        key2: 'value2',
        key3: ''
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle keys without values', () => {
      const input = 'key1,key2:value2,key3';
      const expected: DashboardTag = {
        key2: 'value2'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace around keys and values', () => {
      const input = ' app : media-service , workflow : media ';
      const expected: DashboardTag = {
        app: 'media-service',
        workflow: 'media'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle multiple consecutive commas', () => {
      const input = 'key1:value1,,key2:value2,,,key3:value3';
      const expected: DashboardTag = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle trailing comma', () => {
      const input = 'key1:value1,key2:value2,';
      const expected: DashboardTag = {
        key1: 'value1',
        key2: 'value2'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle leading comma', () => {
      const input = ',key1:value1,key2:value2';
      const expected: DashboardTag = {
        key1: 'value1',
        key2: 'value2'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle mixed whitespace and empty pairs', () => {
      const input = ' , key1:value1 , , key2:value2 , ';
      const expected: DashboardTag = {
        key1: 'value1',
        key2: 'value2'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });
  });

  describe('error handling and invalid inputs', () => {
    it('should return empty object for null input', () => {
      const result = parseDashboardTags(null as any);
      expect(result).toEqual({});
    });

    it('should return empty object for undefined input', () => {
      const result = parseDashboardTags(undefined as any);
      expect(result).toEqual({});
    });

    it('should return empty object for empty string', () => {
      const result = parseDashboardTags('');
      expect(result).toEqual({});
    });

    it('should return empty object for whitespace-only string', () => {
      const result = parseDashboardTags('   ');
      expect(result).toEqual({});
    });

    it('should return empty object for non-string input', () => {
      const result = parseDashboardTags(123 as any);
      expect(result).toEqual({});
    });

    it('should return empty object for boolean input', () => {
      const result = parseDashboardTags(true as any);
      expect(result).toEqual({});
    });

    it('should return empty object for object input', () => {
      const result = parseDashboardTags({} as any);
      expect(result).toEqual({});
    });
  });

  describe('complex scenarios', () => {
    it('should handle special characters in keys and values', () => {
      const input = 'user-name:john_doe,email:john.doe@example.com,role:admin-user';
      const expected: DashboardTag = {
        'user-name': 'john_doe',
        email: 'john.doe@example.com',
        role: 'admin-user'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle numeric values as strings', () => {
      const input = 'version:1.0.0,port:8080,timeout:30000';
      const expected: DashboardTag = {
        version: '1.0.0',
        port: '8080',
        timeout: '30000'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle very long values', () => {
      const longValue = 'a'.repeat(1000);
      const input = `key1:${longValue},key2:short`;
      const expected: DashboardTag = {
        key1: longValue,
        key2: 'short'
      };

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });

    it('should handle many key-value pairs', () => {
      const pairs = Array.from({ length: 100 }, (_, i) => `key${i}:value${i}`);
      const input = pairs.join(',');
      const expected: DashboardTag = {};
      
      for (let i = 0; i < 100; i++) {
        expected[`key${i}`] = `value${i}`;
      }

      const result = parseDashboardTags(input);
      expect(result).toEqual(expected);
    });
  });

  describe('DashboardTag type compatibility', () => {
    it('should return object compatible with DashboardTag type', () => {
      const input = 'repo:my-repo,env:production';
      const result = parseDashboardTags(input);

      // Verify the result has the expected structure
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('repo');
      expect(result).toHaveProperty('env');
      expect(typeof result.repo).toBe('string');
      expect(typeof result.env).toBe('string');
    });

    it('should allow additional string properties as per Record<string, string>', () => {
      const input = 'customKey:customValue,anotherKey:anotherValue';
      const result = parseDashboardTags(input);

      // These should be valid according to the type definition
      expect(result.customKey).toBe('customValue');
      expect(result.anotherKey).toBe('anotherValue');
    });
  });
});
