import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { ConfigLoader } from '../../src/core/config-loader';

const files: string[] = [];

afterEach(() => {
  for (const file of files) {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }
  files.length = 0;
});

describe('ConfigLoader invalid rules', () => {
  it('rejects non-object rule', async () => {
    const file = 'test-config-invalid-rule-1.js';
    files.push(file);
    writeFileSync(file, `export default { rules: ['bad'] };`);
    await expect(ConfigLoader.load(file)).rejects.toThrow('Rule at index 0: Rule must be an object');
  });

  it('rejects empty targets', async () => {
    const file = 'test-config-invalid-rule-2.js';
    files.push(file);
    writeFileSync(file, `export default { rules: [{ file: 'a.md', to: './', targets: [] }] };`);
    await expect(ConfigLoader.load(file)).rejects.toThrow('Rule.targets must be a non-empty array');
  });

  it('rejects invalid agent target object', async () => {
    const file = 'test-config-invalid-rule-3.js';
    files.push(file);
    writeFileSync(file, `export default { rules: [{ file: 'a.md', to: './', targets: [{ name: 'claude', to: 123 }] }] };`);
    await expect(ConfigLoader.load(file)).rejects.toThrow('Rule.targets must contain valid agents');
  });

  it('rejects invalid rule mode', async () => {
    const file = 'test-config-invalid-rule-4.js';
    files.push(file);
    writeFileSync(file, `export default { rules: [{ file: 'a.md', to: './', targets: ['claude'], mode: 'bad' }] };`);
    await expect(ConfigLoader.load(file)).rejects.toThrow('Rule.mode must be "copy" or "symlink"');
  });
});
