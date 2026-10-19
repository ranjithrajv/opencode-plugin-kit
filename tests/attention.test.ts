import { describe, expect, test, vi } from "vitest"
import { requestAttention, notifyTaskComplete, notifyError } from "../src/attention.ts"

function attentionContext(notifyResult?: { ok: boolean; notification?: boolean; sound?: boolean }) {
  const toasts: Array<{ message: string; variant?: string }> = []
  const notify = vi.fn(() => Promise.resolve(notifyResult ?? { ok: true, notification: true, sound: false }))
  const context: any = {
    attention: { notify },
    ui: {
      toast: { show: (input: { message: string; variant?: string }) => toasts.push(input) },
    },
  }
  return { context, toasts, notify }
}

describe("requestAttention", () => {
  test("calls attention.notify with the correct options", async () => {
    const { context, notify } = attentionContext()
    const result = await requestAttention(context, { message: "Done!", title: "Task" })

    expect(notify).toHaveBeenCalledWith({
      title: "Task",
      message: "Done!",
      notification: true,
      sound: false,
    })
    expect(result).toEqual({ ok: true, notified: true, sounded: false, fellBack: false })
  })

  test("respects custom notification and sound flags", async () => {
    const { context, notify } = attentionContext({ ok: true, notification: false, sound: true })
    const result = await requestAttention(context, {
      message: "Alert",
      notification: false,
      sound: true,
    })

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ notification: false, sound: true }))
    expect(result.notified).toBe(false)
    expect(result.sounded).toBe(true)
  })

  test("falls back to toast when the host has no attention support", async () => {
    const toasts: Array<{ message: string; variant?: string }> = []
    const context: any = {
      ui: {
        toast: { show: (input: { message: string; variant?: string }) => toasts.push(input) },
      },
    }
    const result = await requestAttention(context, { message: "Hello" })

    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe("Hello")
    expect(result.ok).toBe(true)
    expect(result.fellBack).toBe(true)
    expect(result.notified).toBe(false)
  })

  test("does not fall back to toast when fallbackToast is false", async () => {
    const toasts: Array<{ message: string; variant?: string }> = []
    const context: any = {
      ui: {
        toast: { show: (input: { message: string; variant?: string }) => toasts.push(input) },
      },
    }
    const result = await requestAttention(context, { message: "Hello", fallbackToast: false })

    expect(toasts).toHaveLength(0)
    expect(result.ok).toBe(false)
    expect(result.fellBack).toBe(false)
  })

  test("falls back to toast when attention.notify throws", async () => {
    const toasts: Array<{ message: string; variant?: string }> = []
    const context: any = {
      attention: {
        notify: () => Promise.reject(new Error("attention failed")),
      },
      ui: {
        toast: { show: (input: { message: string; variant?: string }) => toasts.push(input) },
      },
    }
    const result = await requestAttention(context, { message: "Hello" })

    expect(toasts).toHaveLength(1)
    expect(result.ok).toBe(true)
    expect(result.fellBack).toBe(true)
  })

  test("does not throw when attention is missing entirely", async () => {
    const context: any = { ui: { toast: { show: () => {} } } }
    await expect(requestAttention(context, { message: "Hi" })).resolves.toBeTruthy()
  })

  test("returns ok:true when notify result has undefined ok", async () => {
    const { context } = attentionContext({ notification: true, sound: false } as any)
    // ok is undefined in the result, so result?.ok ?? true should yield true
    const result = await requestAttention(context, { message: "Hello" })
    expect(result.ok).toBe(true)
  })

  test("defaults notified and sounded to false when result lacks those fields", async () => {
    const toasts: Array<{ message: string; variant?: string }> = []
    const notify = vi.fn(() => Promise.resolve({ ok: true }))
    const context: any = {
      attention: { notify },
      ui: {
        toast: { show: (input: { message: string; variant?: string }) => toasts.push(input) },
      },
    }
    const result = await requestAttention(context, { message: "Hello" })
    expect(result.notified).toBe(false)
    expect(result.sounded).toBe(false)
  })

  test("falls back to toast when attention.notify throws and fallbackToast is not false", async () => {
    const toasts: Array<{ message: string; variant?: string }> = []
    const context: any = {
      attention: {
        notify: () => Promise.reject(new Error("fail")),
      },
      ui: {
        toast: { show: (input: { message: string; variant?: string }) => toasts.push(input) },
      },
    }
    const result = await requestAttention(context, { message: "Hello", fallbackToast: true })
    expect(toasts).toHaveLength(1)
    expect(result.fellBack).toBe(true)
    expect(result.ok).toBe(true)
  })

  test("does not show toast when attention.notify throws and fallbackToast is false", async () => {
    const toasts: Array<{ message: string; variant?: string }> = []
    const context: any = {
      attention: {
        notify: () => Promise.reject(new Error("fail")),
      },
      ui: {
        toast: { show: (input: { message: string; variant?: string }) => toasts.push(input) },
      },
    }
    const result = await requestAttention(context, { message: "Hello", fallbackToast: false })
    expect(toasts).toHaveLength(0)
    expect(result.fellBack).toBe(false)
    expect(result.ok).toBe(false)
  })
})

describe("notifyTaskComplete", () => {
  test("requests attention with sound and notification", async () => {
    const { context, notify } = attentionContext({ ok: true, notification: true, sound: true })
    await notifyTaskComplete(context, "Build finished", "Build")

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Build",
        message: "Build finished",
        notification: true,
        sound: true,
      }),
    )
  })

  test("uses default title when not provided", async () => {
    const { context, notify } = attentionContext()
    await notifyTaskComplete(context, "Done")

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Task complete" }))
  })
})

describe("notifyError", () => {
  test("requests attention with notification but no sound", async () => {
    const { context, notify } = attentionContext({ ok: true, notification: true, sound: false })
    await notifyError(context, "Something broke", "Error")

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Error",
        message: "Something broke",
        notification: true,
        sound: false,
      }),
    )
  })

  test("uses default title when not provided", async () => {
    const { context, notify } = attentionContext()
    await notifyError(context, "Failed")

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Error" }))
  })
})
