import { describe, expect, test } from "vitest"
import { createPersistedState } from "../src/persistedState.ts"

describe("createPersistedState", () => {
  test("uses the host's reactive memory store when available", () => {
    const mutations: Array<(draft: { n: number }) => void> = []
    const context: any = {
      storage: {
        memory: (_key: string, opts: { initial: { n: number } }) => {
          const store = structuredClone(opts.initial)
          return [
            store,
            (mutation: (draft: { n: number }) => void) => {
              mutations.push(mutation)
              // Host stores mutate the live cell in place (and signal).
              mutation(store)
            },
          ]
        },
      },
    }
    const state = createPersistedState(context, "ui", { n: 1 })
    expect(state.state()).toEqual({ n: 1 })
    state.update((draft) => {
      draft.n = 2
    })
    expect(mutations).toHaveLength(1)
    expect(state.state()).toEqual({ n: 2 })
  })

  test("falls back to the durable store when memory throws", () => {
    const cell = { n: 1 }
    const context: any = {
      storage: {
        memory: () => {
          throw new Error("no memory")
        },
        store: (_key: string, opts: { initial: { n: number } }) => [Object.assign(cell, opts.initial), cell],
      },
    }
    const state = createPersistedState(context, "ui", { n: 1 })
    expect(state.state()).toEqual({ n: 1 })
    state.update((draft) => {
      draft.n = 3
    })
    expect(state.state()).toEqual({ n: 3 })
    expect(cell.n).toBe(3)
  })

  test("uses the durable store when no memory store exists", () => {
    const cell = { n: 1 }
    const context: any = {
      storage: { store: (_key: string, opts: { initial: { n: number } }) => [Object.assign(cell, opts.initial), cell] },
    }
    const state = createPersistedState(context, "ui", { n: 1 })
    state.update((draft) => {
      draft.n = 4
    })
    expect(cell.n).toBe(4)
  })

  test("falls back to a signal when the store is unusable", () => {
    const nonObject: any = { storage: { store: () => [null, null] } }
    const nonObjectState = createPersistedState(nonObject, "ui", { n: 1 })
    nonObjectState.update((draft) => {
      draft.n = 5
    })
    expect(nonObjectState.state()).toEqual({ n: 5 })

    const throwing: any = {
      storage: {
        store: () => {
          throw new Error("no store")
        },
      },
    }
    const throwingState = createPersistedState(throwing, "ui", { n: 1 })
    throwingState.update((draft) => {
      draft.n = 6
    })
    expect(throwingState.state()).toEqual({ n: 6 })
  })

  test("works with no storage at all", () => {
    const context: any = {}
    const state = createPersistedState(context, "ui", { n: 1 })
    state.update((draft) => {
      draft.n = 7
    })
    expect(state.state()).toEqual({ n: 7 })
  })

  test("shallow-copies state that structuredClone cannot handle", () => {
    const context: any = {}
    const initial = { n: 1, fn: () => 1 }
    const state = createPersistedState(context, "ui", initial)
    state.update((draft) => {
      draft.n = 8
    })
    expect(state.state().n).toBe(8)
    expect(state.state().fn).toBe(initial.fn)
  })
})
