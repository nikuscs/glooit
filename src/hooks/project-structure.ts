import type { SyncContext } from '../types';

export const replaceStructure = async (context: SyncContext): Promise<string> => {
  const structure = await getProjectStructure();
  return context.content.replace(/__STRUCTURE__/g, structure);
};

async function getProjectStructure(maxDepth: number = 3): Promise<string> {
  try {
    const { readdirSync, statSync } = await import('fs');
    const { join } = await import('path');

    const buildTree = (dir: string, depth: number = 0, prefix: string = ''): string[] => {
      if (depth > maxDepth) return [];

      try {
        const items = readdirSync(dir);
        const result: string[] = [];

        // Filter out common ignored directories
        const filtered = items.filter(item =>
          !item.startsWith('.') &&
          item !== 'node_modules' &&
          item !== 'dist' &&
          item !== 'build'
        );

        filtered.forEach((item, index) => {
          const isLast = index === filtered.length - 1;
          const itemPath = join(dir, item);
          const connector = isLast ? '└── ' : '├── ';
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');

          result.push(prefix + connector + item);

          try {
            const stat = statSync(itemPath);
            if (stat.isDirectory()) {
              result.push(...buildTree(itemPath, depth + 1, nextPrefix));
            }
          } catch {
            // Skip if can't access
          }
        });

        return result;
      } catch {
        return [];
      }
    };

    const tree = buildTree('.');
    return '```\n' + tree.join('\n') + '\n```';
  } catch {
    return '```\nProject structure unavailable\n```';
  }
}