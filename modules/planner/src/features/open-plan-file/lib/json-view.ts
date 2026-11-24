import { json } from '@codemirror/lang-json'
import {
  bracketMatching,
  codeFolding,
  ensureSyntaxTree,
  foldedRanges,
  foldEffect,
  foldGutter,
  HighlightStyle,
  syntaxHighlighting,
  syntaxTree,
  unfoldAll,
  unfoldEffect,
} from '@codemirror/language'
import { SearchCursor } from '@codemirror/search'
import { EditorState, StateEffect, StateField, type Range } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
  type DecorationSet,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'

/** More matches than this are not counted: the text is a plan, not a log. */
const MAX_MATCHES = 5000
const lower = (s: string) => s.toLowerCase()

export interface JsonView {
  /** Marks every occurrence of the text, ignoring case, shows the first one and returns how many there are */
  find: (query: string) => number
  /** Scrolls to the match with this index and marks it as the current one */
  show: (index: number) => void
  /** Folds the value of every top-level key, which leaves the outline of the document */
  collapse: () => void
  expand: () => void
  destroy: () => void
}

interface Found {
  ranges: { from: number; to: number }[]
  current: number
}

const setFound = StateEffect.define<Found>()
const MATCH = Decoration.mark({ class: 'cm-found' })
const CURRENT = Decoration.mark({ class: 'cm-found cm-found-current' })

const found = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (!effect.is(setFound)) continue
      const marks: Range<Decoration>[] = effect.value.ranges.map((r, i) =>
        (i === effect.value.current ? CURRENT : MATCH).range(r.from, r.to),
      )
      return Decoration.set(marks)
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

// The colors are the theme's own tokens, so the text follows the light and the dark theme without a second palette.
const COLORS = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--focus)' },
  { tag: tags.string, color: 'var(--done-ink)' },
  { tag: tags.number, color: 'var(--today-ink)' },
  { tag: [tags.bool, tags.null], color: 'var(--today-ink)', fontWeight: '600' },
  { tag: [tags.separator, tags.squareBracket, tags.brace], color: 'var(--muted)' },
])

const LOOK = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', color: 'var(--ink)', backgroundColor: 'var(--surface-2)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '20px' },
  '.cm-content': { padding: '10px 0' },
  '.cm-gutters': {
    color: 'var(--muted)',
    backgroundColor: 'var(--surface-2)',
    borderRight: '1px solid var(--line-soft)',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 14px' },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', cursor: 'pointer' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--focus) 8%, transparent)' },
  '.cm-activeLineGutter': { color: 'var(--ink)', backgroundColor: 'color-mix(in srgb, var(--focus) 8%, transparent)' },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--focus) 22%, transparent)',
    outline: '1px solid var(--focus)',
  },
  '.cm-foldPlaceholder': {
    margin: '0 4px',
    padding: '0 6px',
    color: 'var(--muted)',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: '6px',
  },
  '.cm-found': { backgroundColor: 'color-mix(in srgb, var(--focus) 18%, transparent)', borderRadius: '3px' },
  '.cm-found-current': {
    backgroundColor: 'color-mix(in srgb, var(--focus) 42%, transparent)',
    outline: '1px solid var(--focus)',
  },
})

/** How many members or items the folded object or array has: shown in place of what is hidden. */
function sizeOf(state: EditorState, from: number): number {
  const container = syntaxTree(state).resolveInner(from, -1).parent
  let count = 0
  // Members and values are named nodes; brackets and commas are not.
  for (let child = container?.firstChild; child; child = child.nextSibling) if (/^[A-Z]/.test(child.name)) count += 1
  return count
}

/** A read-only view of JSON text with colors, line numbers and folding, mounted into `parent`. */
export function mountJsonView(parent: HTMLElement, text: string, label: string): JsonView {
  let ranges: Found['ranges'] = []
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        // Not editable, so it is not in the tab order on its own: it has to be, to scroll it from the keyboard.
        EditorView.contentAttributes.of({ tabindex: '0', 'aria-label': label, 'aria-readonly': 'true' }),
        lineNumbers(),
        codeFolding({
          preparePlaceholder: (state, range) => sizeOf(state, range.from),
          placeholderDOM(_view, onclick, size: number) {
            const pill = document.createElement('span')
            pill.className = 'cm-foldPlaceholder'
            pill.textContent = `… ${size}`
            pill.addEventListener('click', onclick)
            return pill
          },
        }),
        foldGutter(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        json(),
        syntaxHighlighting(COLORS),
        found,
        LOOK,
      ],
    }),
  })

  function mark(current: number) {
    const at = ranges[current]
    const effects: StateEffect<unknown>[] = [setFound.of({ ranges, current })]
    if (at) {
      foldedRanges(view.state).between(at.from, at.to, (from, to) => void effects.push(unfoldEffect.of({ from, to })))
      effects.push(EditorView.scrollIntoView(at.from, { y: 'center' }))
    }
    view.dispatch({ effects })
  }

  return {
    find(query) {
      ranges = []
      if (query) {
        const cursor = new SearchCursor(view.state.doc, query, 0, view.state.doc.length, lower)
        while (ranges.length < MAX_MATCHES && !cursor.next().done) ranges.push(cursor.value)
      }
      mark(0)
      return ranges.length
    },
    show: mark,
    collapse() {
      const { state } = view
      const root = (ensureSyntaxTree(state, state.doc.length, 2000) ?? syntaxTree(state)).topNode.firstChild
      const effects: StateEffect<unknown>[] = []
      for (let member = root?.firstChild; member; member = member.nextSibling) {
        const value = member.name === 'Property' ? member.lastChild : member
        if (value && (value.name === 'Object' || value.name === 'Array') && value.to - value.from > 2) {
          effects.push(foldEffect.of({ from: value.from + 1, to: value.to - 1 }))
        }
      }
      unfoldAll(view)
      view.dispatch({ effects })
    },
    expand: () => void unfoldAll(view),
    destroy: () => view.destroy(),
  }
}
