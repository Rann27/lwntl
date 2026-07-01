/** Remove the trailing glossary table from translated content. */
export function stripGlossaryTable(content: string): string {
  if (!content) return content
  const lines = content.split('\n')

  // Strategy 1: last '---' followed by a pipe table
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^-{3,}\s*$/.test(lines[i].trim())) {
      const after = lines.slice(i + 1)
      if (after.some(l => /^\|.+\|$/.test(l.trim()))) {
        return lines.slice(0, i).join('\n').trimEnd()
      }
    }
  }

  // Strategy 2: last pipe table block + optional blank lines / bold heading above
  let end = lines.length - 1
  while (end >= 0 && !lines[end].trim()) end--

  if (end >= 0 && /^\|.+\|$/.test(lines[end].trim())) {
    let start = end
    while (start > 0 && /^\|.+\|$/.test(lines[start - 1].trim())) start--

    let stripFrom = start
    for (let i = start - 1; i >= Math.max(-1, start - 5); i--) {
      const s = lines[i].trim()
      if (!s || /^\*\*[^*]+\*\*[:\s]*$/.test(s)) { stripFrom = i } else break
    }
    return lines.slice(0, stripFrom).join('\n').trimEnd()
  }

  return content
}
