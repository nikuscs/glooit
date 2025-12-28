/**
 * Minimal glooit configuration
 * Just the essentials to get started
 */
import { defineRules } from 'glooit';

export default defineRules({
  rules: [
    {
      file: '.glooit/main.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ]
});
