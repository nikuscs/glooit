import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { ConfigLoader } from '../../src/core/config-loader';

const file = 'test-config-to-error.js';

afterEach(() => {
  if (existsSync(file)) {
    unlinkSync(file);
  }
});

describe('ConfigLoader invalid to', () => {
  it('throws when rule.to is invalid for unknown directory type', async () => {
    writeFileSync(file, `
      export default {
        rules: [{
          file: 'custom.md',
          targets: ['claude']
        }]
      };
    `);

    await expect(ConfigLoader.load(file)).rejects.toThrow('Rule.to must be a string');
  });
});
