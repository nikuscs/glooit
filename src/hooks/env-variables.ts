import type { SyncContext } from '../types';

export const replaceEnv = (context: SyncContext): string => {
  let content = context.content;

  // Replace environment variables in the format __ENV_VARIABLE_NAME__
  content = content.replace(/__ENV_([A-Z_]+)__/g, (match, envVar) => {
    return process.env[envVar] || match;
  });

  return content;
};