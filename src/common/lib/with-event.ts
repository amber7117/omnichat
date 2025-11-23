// @ts-nocheck
import { RxEvent } from "@/common/lib/rx-event";

// 简易本地存储替代，避免外部依赖缺失
function createNestedBean<T extends Record<string, unknown>>(initial: T) {
  let state = initial;
  return {
    get: () => state,
    set: (updater: (prev: T) => T) => {
      state = updater(state);
    },
  };
}

export class WithState<T extends Record<string, unknown>> {
  store: ReturnType<typeof createNestedBean<T>>;

  onStateChange$ = new RxEvent<[T, T]>();

  constructor(initialState: T) {
    this.store = createNestedBean(initialState);
  }

  getState() {
    return this.store.get();
  }

  setState(updates: Partial<T>) {
    const prev = this.getState();
    this.store.set((prev) => ({ ...prev, ...updates }));
    this.onStateChange$.next([prev, this.getState()]);
  }

}
