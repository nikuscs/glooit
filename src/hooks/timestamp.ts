import type { SyncContext } from '../types';

export const addTimestamp = (context: SyncContext): string => {
  const now = new Date();
  const timestamp = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  return context.content.replace(/__TIMESTAMP__/g, timestamp);
};