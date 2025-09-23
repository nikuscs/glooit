import type { SyncContext } from '../types';

export type HookFunction = (context: any) => void | Promise<void> | string | Promise<string>;

export interface HookRegistry {
  [hookName: string]: HookFunction;
}

export class HookManager {
  private hooks: HookRegistry = {};

  constructor() {
    // Don't auto-register builtin hooks
  }

  register(name: string, hook: HookFunction): void {
    this.hooks[name] = hook;
  }

  async execute(name: string, context: any): Promise<string | void> {
    const hook = this.hooks[name];
    if (!hook) {
      console.warn(`Hook '${name}' not found`);
      return;
    }

    try {
      return await hook(context);
    } catch (error) {
      throw new Error(`Hook '${name}' failed: ${error}`);
    }
  }

  list(): string[] {
    return Object.keys(this.hooks);
  }

}