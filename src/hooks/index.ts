
export type HookFunction = (context: unknown) => void | Promise<void> | string | Promise<string>;

export type HookRegistry = Record<string, HookFunction>;

export class HookManager {
  private hooks: HookRegistry = {};



  register(name: string, hook: HookFunction): void {
    this.hooks[name] = hook;
  }

  async execute(name: string, context: unknown): Promise<string | void> {
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