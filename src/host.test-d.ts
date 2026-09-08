// Type-level compatibility contract between opencode-plugin-kit and the
// beta host API (`@opencode-ai/plugin` + `@opencode-ai/sdk`).
//
// If the host's published types drift away from what kit consumes, these
// `expectTypeOf` assertions fail CI — surfacing the breakage at typecheck
// time instead of at runtime in a user's TUI.
import { expectTypeOf, test } from "vitest"
import type { AssistantMessage, Model } from "@opencode-ai/sdk/v2"
import type {
  TuiCommand,
  TuiDialogSelectOption,
  TuiDialogSelectProps,
  TuiPluginApi,
  TuiToast,
} from "@opencode-ai/plugin/tui"
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
} from "./index.ts"
import type { PickerConfig, PickerOption, ViewPicker } from "./viewPicker.ts"

// ---------------------------------------------------------------------------
// Host → kit input compatibility (the shapes kit populates are host-shaped)
// ---------------------------------------------------------------------------

test("toast payload matches the host TuiToast contract", () => {
  expectTypeOf<TuiToast>().toExtend<ToastInput>()
})

test("picker options match the host dialog select option contract", () => {
  expectTypeOf<SelectOption<string>>().toExtend<TuiDialogSelectOption<string>>()
  expectTypeOf<Pick<TuiDialogSelectProps<string>, "title" | "options">>().toExtend<{
    title: string
    options: readonly SelectOption[]
  }>()
})

test("the picker's command fields are a structural subset of the host command shape", () => {
  expectTypeOf<Pick<KitCommandEntry, "title" | "description" | "suggested" | "slash">>().toExtend<TuiCommand>()
})

test("kit storage satisfies the structural minimum consumers rely on", () => {
  interface Row {
    id: string
  }
  const [, ref] = expectTypeOf({} as KitStorage).store("k", { initial: { id: "a" } as Row })
  expectTypeOf(ref).toEqualTypeOf<Row>()
})

// ---------------------------------------------------------------------------
// Host message/model shapes satisfy kit's defensive readers
// (AssistantMessage / Model are the beta spec; drift breaks here, not runtime)
// ---------------------------------------------------------------------------

test("host AssistantMessage satisfies kit's message shape", () => {
  expectTypeOf<AssistantMessage>().toExtend<KitMessageShape>()
  const m = expectTypeOf({} as AssistantMessage)
  expectTypeOf(providerId(m.get())).toEqualTypeOf<string>()
  expectTypeOf(modelId(m.get())).toEqualTypeOf<string>()
  expectTypeOf(isAssistant(m.get())).toEqualTypeOf<boolean>()
})

test("host Model list objects resolve through kit's model accessors", () => {
  const m = expectTypeOf({} as Model)
  expectTypeOf(modelId(m.get())).toEqualTypeOf<string>()
  expectTypeOf(providerId(m.get())).toEqualTypeOf<string>()
  expectTypeOf(modelName(m.get())).toEqualTypeOf<string>()
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

test("host dialog/toast primitives pin kit's ui surface shape", () => {
  // The published TuiPluginApi wraps toast as `ui.toast(input: TuiToast)`;
  // kit's `ui.toast.show` mirrors that payload. Pinning ToastInput (above)
  // plus the select-props contract is the compile-time link to the host —
  // the full plugin-api → KitContext mapping is done by each consumer's
  // wrapper and is intentionally not asserted here.
  expectTypeOf<TuiPluginApi["ui"]["toast"]>().toEqualTypeOf<(input: TuiToast) => void>()
})
