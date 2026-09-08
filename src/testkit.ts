import type { KitContext } from "./host.ts"
import { vi } from "vitest"

/** A storage cell the fake KitStorage hands out (the unwrapped `[value, ref]` shape). */
export interface FakeCell<T> {
  value: T
}

/** Storage that returns one shared cell per key (mutating ref = mutating the cell). */
export function fakeStorage(cells: Record<string, unknown> = {}) {
  const state = cells as Record<string, unknown>
  return {
    store<T extends object>(key: string, opts: { initial: T }): [T, T] {
      const restored = (state[key] ??= structuredClone(opts.initial)) as T
      return [restored, restored]
    },
  }
}

export function fakeContext(overrides: Partial<KitContext> = {}): KitContext & {
  toastCalls: Array<{ message: string; variant?: string }>
  alertCalls: unknown[]
  selectCalls: unknown[]
  slotCalls: Array<Record<string, unknown>>
  layerCalls: unknown[]
  messages: unknown[]
  selectValue: string
} {
  const toastCalls: Array<{ message: string; variant?: string }> = []
  const alertCalls: unknown[] = []
  const selectCalls: unknown[] = []
  const slotCalls: Array<Record<string, unknown>> = []
  const layerCalls: unknown[] = []
  const messages: unknown[] = []
  const selectValue = { v: "" }

  const context = {
    storage: fakeStorage(),
    ui: {
      toast: { show: vi.fn((input: { message: string; variant?: string }) => toastCalls.push(input)) },
      dialog: {
        alert: vi.fn((input: unknown) => {
          alertCalls.push(input)
          return Promise.resolve()
        }),
        select: vi.fn((input: unknown) => {
          selectCalls.push(input)
          return Promise.resolve(selectValue.v)
        }),
      },
      slot: vi.fn((options: Record<string, unknown>) => {
        slotCalls.push(options)
        return () => {}
      }),
    },
    keymap: {
      layer: vi.fn((register: () => unknown) => {
        layerCalls.push(register())
      }),
    },
    data: {
      session: {
        message: {
          list: vi.fn((_sessionID: string) => messages),
        },
      },
    },
    client: {
      integration: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
      },
    },
    ...overrides,
  } as never
  const extras = {
    toastCalls,
    alertCalls,
    selectCalls,
    slotCalls,
    layerCalls,
    messages,
  }
  const result = Object.assign(context as KitContext, extras) as unknown as KitContext & { selectValue: string }
  // defineProperty (not Object.assign) so the accessor survives.
  Object.defineProperty(result, "selectValue", {
    get: () => selectValue.v,
    set: (v: string) => {
      selectValue.v = v
    },
  })
  return result as never
}
