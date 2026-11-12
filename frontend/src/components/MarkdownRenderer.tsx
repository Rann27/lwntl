/**
 * LWNTL Markdown Renderer
 * Renders translated content using react-markdown + remark-gfm.
 * "Image Placeholder: <file>" lines are rendered as real <img> when a matching
 * asset is provided via the `images` map ({ filename: data-URI }); otherwise the
 * placeholder text is kept so nothing is lost.
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
  images?: Record<string, string> // filename -> data-URI
}

// Matches "Image Placeholder: file.jpg" / "Illustration PlaceHolder" (filename optional)
const PLACEHOLDER_LINE_RE = /^(?:Image|Illustration)\s+Place[Hh]older(?:\s*:\s*(.+?))?\s*$/i
const ASSET_PREFIX = 'lwntl-asset:'

function normalizeDelimiters(text: string): string {
  // Fix space after opening ** or before closing ** (bold)
  return text
    .replace(/\*\* ([^*\n]+?)\*\*/g, '**$1**')  // ** text** → **text**
    .replace(/\*\*([^*\n]+?) \*\*/g, '**$1**')  // **text ** → **text**
}

// Replace resolvable placeholder lines with a markdown image whose URL is a
// sentinel resolved by the `img` component. Placeholders without a known asset
// are left untouched (rendered as plain text).
function inlineImages(content: string, images: Record<string, string>): string {
  if (!content.includes('laceholder') && !content.includes('laceHolder')) return content
  return content
    .split('\n')
    .map((line) => {
      const m = line.trim().match(PLACEHOLDER_LINE_RE)
      if (!m) return line
      const fname = (m[1] || '').trim()
      if (fname && images[fname]) {
        return `![${fname}](${ASSET_PREFIX}${encodeURIComponent(fname)})`
      }
      return line
    })
    .join('\n')
}

export function MarkdownRenderer({ content, images = {} }: MarkdownRendererProps) {
  if (!content) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p style={{ color: 'var(--fg-subtle,#999)', fontSize: '14px', textAlign: 'center' }}>
          Belum ada terjemahan
        </p>
      </div>
    )
  }

  const prepared = inlineImages(normalizeDelimiters(content), images)

  return (
    <div className="markdown-body" style={{ padding: '16px', fontSize: '14px', lineHeight: '1.7' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // Keep our sentinel and data: URIs intact (content is our own translation text).
        urlTransform={(url) => url}
        components={{
          // Render *** / --- / ___ as literal "***" text instead of <hr>
          hr: () => (
            <span style={{ display: 'block', textAlign: 'center', margin: '8px 0', letterSpacing: '4px', color: 'var(--fg-subtle,#999)' }}>
              ***
            </span>
          ),
          img: ({ src, alt }) => {
            let uri: string | undefined
            const s = typeof src === 'string' ? src : ''
            if (s.startsWith(ASSET_PREFIX)) {
              uri = images[decodeURIComponent(s.slice(ASSET_PREFIX.length))]
            } else if (s.startsWith('data:')) {
              uri = s
            } else if (alt && images[alt]) {
              uri = images[alt]
            }
            if (!uri) {
              return (
                <span style={{ display: 'block', textAlign: 'center', color: 'var(--fg-subtle,#999)', fontSize: '12px', fontStyle: 'italic', margin: '8px 0' }}>
                  [{alt || 'image'}]
                </span>
              )
            }
            return (
              <img
                src={uri}
                alt={alt || ''}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto',
                  margin: '14px auto',
                  border: '2px solid var(--color-border)',
                  boxShadow: '3px 3px 0 var(--color-border)',
                }}
              />
            )
          },
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  )
}
