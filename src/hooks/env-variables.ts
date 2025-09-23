import type { SyncContext } from '../types';

export const replaceEnv = (context: SyncContext): string => {
  let content = context.content;

  content = content.replace(/__ENV_([A-Z_]+)__/g, (match, envVar) => {
    return process.env[envVar] || match;
  });

  return content;
};