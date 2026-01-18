import { describe, it, expect } from 'vitest';
import { getAgentMcpPath } from '../../src/agents';

// Cover non-test environment branch for ~/ expansion

describe('getAgentMcpPath production expansion', () => {
  it('expands ~ for cursor when not in test environment', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const path = getAgentMcpPath('cursor');
    expect(path).toMatch(/\/\.cursor\/mcp\.json$/);

    process.env.NODE_ENV = originalEnv;
  });
});
