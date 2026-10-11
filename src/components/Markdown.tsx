import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import './Markdown.css'

// Como en la intra: GitHub Flavored Markdown y los saltos de línea cuentan.
marked.use({ gfm: true, breaks: true })

// Los enlaces se abren en otra pestaña y sin acceso a esta.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

interface MarkdownProps {
  text: string | null | undefined
  className?: string
}

/**
 * Texto en Markdown (las descripciones de la intra lo son, a veces con algo
 * de HTML) convertido a HTML y saneado antes de pintarlo.
 */
function Markdown({ text, className = '' }: MarkdownProps) {
  // Sin extensiones asíncronas, marked.parse devuelve el HTML directamente.
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text ?? '', { async: false })), [text])
  return <div className={`markdown ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />
}

export default Markdown
