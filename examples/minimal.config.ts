/**
 * Minimal glooit configuration
 * Just the essentials to get started
 */
import { defineRules } from 'glooit';

export default defineRules({
  mode: 'copy',
  rules: [
    {
      file: '.agents/main.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ]
});
