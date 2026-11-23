import type { KeyboardEvent } from 'react'

/**
 * True for a key that belongs to an IME composition, such as the Enter that picks a Chinese or Japanese candidate:
 * it must not submit, choose or close anything. Safari can clear `isComposing` before that Enter arrives; its key
 * code is 229 then.
 */
export const composing = (e: KeyboardEvent) =>
  // oxlint-disable-next-line typescript/no-deprecated -- 229 is the only sign Safari gives of that Enter; nothing newer carries it
  e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229
