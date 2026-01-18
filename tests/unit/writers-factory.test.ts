import { describe, it, expect } from 'vitest';
import { AgentWriterFactory } from '../../src/agents/writers';
import { MarkdownWriter } from '../../src/agents/writers/generic';

// Ensure default branch is covered with a cast

describe('AgentWriterFactory default', () => {
  it('falls back to MarkdownWriter for unknown agent', () => {
    const writer = AgentWriterFactory.createWriter('unknown' as unknown as never);
    expect(writer).toBeInstanceOf(MarkdownWriter);
  });
});
