interface Piece {
  offset: number
  text: string
  code: boolean
}

function pieces(text: string): Piece[] {
  const result: Piece[] = []
  let offset = 0
  for (const part of text.split(/(`[^`]+`)/)) {
    const code = part.length > 1 && part.startsWith('`') && part.endsWith('`')
    if (part) result.push({ offset, text: code ? part.slice(1, -1) : part, code })
    offset += part.length
  }
  return result
}

/** Text from the syllabus, where `backticks` mark code: file names, commands and identifiers. */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {pieces(text).map((piece) =>
        piece.code ? (
          <code key={piece.offset} className="lc-code" translate="no">
            {piece.text}
          </code>
        ) : (
          <span key={piece.offset}>{piece.text}</span>
        ),
      )}
    </>
  )
}
