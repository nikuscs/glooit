import type { SyncContext } from '../types';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export const replaceStructure = async (context: SyncContext): Promise<string> => {
  const structure = await getProjectStructure();
  return context.content.replace(/__STRUCTURE__/g, structure);
};

async function getProjectStructure(maxDepth = 3): Promise<string> {
  try {
    const buildTree = (dir: string, depth = 0, prefix = ''): string[] => {
      if (depth > maxDepth) return [];

      try {
        const items = readdirSync(dir);
        const result: string[] = [];

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
    /* istanbul ignore next -- defensive fallback */
    return '```\nProject structure unavailable\n```';
  }
}
