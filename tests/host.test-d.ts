// Type-level compatibility contract between opencode-plugin-kit and the
// V2 host API (`@opencode/plugin` + `@opencode/client`).
//
// If the host's published types drift away from what kit consumes, these
// assertions fail the typecheck — surfacing the breakage at compile time
// instead of at runtime in a user's TUI. Run with `npm run test:types`.
import { expectTypeOf, test } from "vitest"
import type { ModelInfo, SessionMessageAssistant } from "@opencode/client"
import type {
  Context,
  DialogSelectOption,
  DialogSelectOptions,
  KeymapCommand,
  ToastOptions,
} from "@opencode/plugin/tui/context"
import {
  asArray,
  createViewPicker,
  isAssistant,
  modelId,
  modelName,
  providerId,
  unwrap,
  type KitCommandEntry,
  type KitContext,
  type KitMessageShape,
  type KitStorage,
  type SelectOption,
  type ToastInput,
} from "../src/index.ts"
import type { PickerConfig, PickerOption, ViewPicker } from "../src/viewPicker.ts"

// ---------------------------------------------------------------------------
// Host → kit input compatibility (the shapes kit populates are host-shaped)
// ---------------------------------------------------------------------------

test("toast payload matches the host ToastOptions contract", () => {
  expectTypeOf<ToastOptions>().toExtend<ToastInput>()
})

test("picker options match the host dialog select option contract", () => {
  expectTypeOf<SelectOption<string>>().toExtend<DialogSelectOption<string>>()
  expectTypeOf<Pick<DialogSelectOptions<string>, "title" | "options">>().toExtend<{
    title: string
    options: readonly SelectOption[]
  }>()
})

test("the picker's command entry is a structural subset of the host command shape", () => {
  expectTypeOf<KitCommandEntry>().toExtend<KeymapCommand>()
})

test("kit storage satisfies the structural minimum consumers rely on", () => {
  interface Row {
    id: string
  }
  const [store] = ({} as KitStorage).store("k", { initial: { id: "a" } as Row })
  expectTypeOf(store).toEqualTypeOf<Row>()
})

// ---------------------------------------------------------------------------
// Host message/model shapes satisfy kit's defensive readers
// (SessionMessageAssistant / ModelInfo are the V2 spec; drift breaks here,
// not at runtime)
// ---------------------------------------------------------------------------

test("host assistant message satisfies kit's message shape", () => {
  expectTypeOf<SessionMessageAssistant>().toExtend<KitMessageShape>()
  const m = {} as SessionMessageAssistant
  expectTypeOf(providerId(m)).toEqualTypeOf<string>()
  expectTypeOf(modelId(m)).toEqualTypeOf<string>()
  expectTypeOf(isAssistant(m)).toEqualTypeOf<boolean>()
})

test("host ModelInfo resolves through kit's model accessors", () => {
  const m = {} as ModelInfo
  expectTypeOf(modelId(m)).toEqualTypeOf<string>()
  expectTypeOf(providerId(m)).toEqualTypeOf<string>()
  expectTypeOf(modelName(m)).toEqualTypeOf<string>()
})

test("message envelopes unwrap to their inner message", () => {
  expectTypeOf(unwrap({ info: {} as KitMessageShape })).toEqualTypeOf<KitMessageShape>()
  expectTypeOf(asArray<{ id: string }>({ data: [{ id: "a" }] })).toEqualTypeOf<{ id: string }[]>()
})

// ---------------------------------------------------------------------------
// Kit's public factory signatures (the API consumers compile against)
// ---------------------------------------------------------------------------

interface TestView extends PickerOption {
  readonly providerID: string
}

test("createViewPicker returns the full ViewPicker contract", () => {
  const context = {} as KitContext
  const config = {} as PickerConfig<TestView>
  const picker: ViewPicker<TestView> = createViewPicker(context, config)
  expectTypeOf(picker.current()).toEqualTypeOf<TestView>()
  expectTypeOf(picker.currentID()).toEqualTypeOf<string>()
  expectTypeOf(picker.apply).toEqualTypeOf<(entry: TestView) => void>()
  expectTypeOf(picker.pick).toEqualTypeOf<(arg?: string) => Promise<void>>()
  expectTypeOf(picker.registerCommand).toEqualTypeOf<() => void>()
})

test("host toast pins kit's ui surface shape", () => {
  // V2 wraps toast as `context.ui.toast.show(options)`; kit's `ui.toast.show`
  // mirrors that payload. Pinning ToastInput (above) plus the select-props
  // contract is the compile-time link to the host — the full context →
  // KitContext mapping is done by each consumer's wrapper and is
  // intentionally not asserted here.
  expectTypeOf<Context["ui"]["toast"]["show"]>().toEqualTypeOf<(options: ToastOptions) => void>()
})
