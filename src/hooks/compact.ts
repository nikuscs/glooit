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

    body = compactMarkdown(body, config);

    return frontmatter + body;
  };
};

function compactMarkdown(content: string, config: CompactOptions): string {
  let result = content;

  if (config.trimTrailingSpaces) {
    result = result
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');
  }

  if (config.maxConsecutiveNewlines && config.maxConsecutiveNewlines > 0) {
    const pattern = new RegExp(`\n{${config.maxConsecutiveNewlines + 1},}`, 'g');
    const replacement = '\n'.repeat(config.maxConsecutiveNewlines);
    result = result.replace(pattern, replacement);
  }

  if (config.removeFillerWords) {
    result = removeFillersFromMarkdown(result);
  }

  if (config.compactLists) {
    result = compactLists(result);
  }

  result = result.replace(/\n\n+(#{1,6})/g, '\n\n$1');

  result = result.replace(/\n\n+```/g, '\n\n```');
  result = result.replace(/```\n\n+/g, '```\n\n');

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
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    if (inCodeBlock || line.includes('`')) {
      result.push(line);
      continue;
    }

    let cleanedLine = line;
    for (const filler of fillerWords) {
      const pattern = new RegExp(`\\b${filler}\\b`, 'gi');
      cleanedLine = cleanedLine.replace(pattern, '').replace(/\s{2,}/g, ' ').trim();
    }

    result.push(cleanedLine);
  }

  return result.join('\n');
}

function compactLists(content: string): string {
  return content
    .replace(/(-|\*|\+|\d+\.)\s+([^\n]+)\n\n+(?=(-|\*|\+|\d+\.)\s)/g, '$1 $2\n')
    .replace(/(-|\*|\+|\d+\.)\s+([^\n]+)\n\n+$/g, '$1 $2\n');
}