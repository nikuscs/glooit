import type { SyncContext } from '../types';

export interface CompactOptions {
  preserveFrontmatter?: boolean;
  maxConsecutiveNewlines?: number;
  removeFillerWords?: boolean;
  trimTrailingSpaces?: boolean;
  compactLists?: boolean;
}

const defaultOptions: CompactOptions = {
  preserveFrontmatter: true,
  maxConsecutiveNewlines: 2,
  removeFillerWords: false,
  trimTrailingSpaces: true,
  compactLists: true
};

const fillerWords = [
  'basically', 'literally', 'actually', 'really', 'very', 'quite',
  'pretty much', 'sort of', 'kind of', 'rather', 'fairly'
];

export const compact = (options: CompactOptions = {}) => {
  const config = { ...defaultOptions, ...options };

  return (context: SyncContext): string => {
    let content = context.content;

    // Check if this is Cursor format (has frontmatter)
    const hasFrontmatter = content.startsWith('---');
    let frontmatter = '';
    let body = content;

    if (hasFrontmatter && config.preserveFrontmatter) {
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd !== -1) {
        frontmatter = content.substring(0, frontmatterEnd + 3);
        body = content.substring(frontmatterEnd + 3);
      }
    }

    // Apply compacting to the body
    body = compactMarkdown(body, config);

    return frontmatter + body;
  };
};

function compactMarkdown(content: string, config: CompactOptions): string {
  let result = content;

  // Remove excessive whitespace
  if (config.trimTrailingSpaces) {
    result = result
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');
  }

  // Limit consecutive newlines
  if (config.maxConsecutiveNewlines && config.maxConsecutiveNewlines > 0) {
    const pattern = new RegExp(`\n{${config.maxConsecutiveNewlines + 1},}`, 'g');
    const replacement = '\n'.repeat(config.maxConsecutiveNewlines);
    result = result.replace(pattern, replacement);
  }

  // Remove filler words (be careful with code blocks)
  if (config.removeFillerWords) {
    result = removeFillersFromMarkdown(result);
  }

  // Compact lists
  if (config.compactLists) {
    result = compactLists(result);
  }

  // Clean up spacing around headers
  result = result.replace(/\n\n+(#{1,6})/g, '\n\n$1');

  // Clean up spacing around code blocks
  result = result.replace(/\n\n+```/g, '\n\n```');
  result = result.replace(/```\n\n+/g, '```\n\n');

  // Remove leading/trailing whitespace only if trimTrailingSpaces is enabled
  if (config.trimTrailingSpaces) {
    result = result.trim();
  }

  return result;
}

function removeFillersFromMarkdown(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code block boundaries
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    // Skip processing inside code blocks or lines with inline code
    if (inCodeBlock || line.includes('`')) {
      result.push(line);
      continue;
    }

    let cleanedLine = line;
    for (const filler of fillerWords) {
      // Remove filler words but preserve sentence structure
      const pattern = new RegExp(`\\b${filler}\\b`, 'gi');
      cleanedLine = cleanedLine.replace(pattern, '').replace(/\s{2,}/g, ' ').trim();
    }

    result.push(cleanedLine);
  }

  return result.join('\n');
}

function compactLists(content: string): string {
  // Remove extra newlines between list items
  return content
    .replace(/(-|\*|\+|\d+\.)\s+([^\n]+)\n\n+(?=(-|\*|\+|\d+\.)\s)/g, '$1 $2\n')
    .replace(/(-|\*|\+|\d+\.)\s+([^\n]+)\n\n+$/g, '$1 $2\n');
}