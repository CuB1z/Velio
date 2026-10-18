import { useEffect } from 'react'

type DocumentHead = {
  description?: string
  canonical?: string
  alternates?: Record<string, string>
  noindex?: boolean
}

export function useDocumentHead(head: DocumentHead): void {
  const key = JSON.stringify(head)

  useEffect(() => {
    const { description, canonical, alternates = {}, noindex } = JSON.parse(key) as DocumentHead
    const added: Element[] = []
    const add = (tag: string, attrs: Record<string, string>) => {
      const element = document.createElement(tag)
      for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value)
      document.head.append(element)
      added.push(element)
    }

    const meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previous = meta?.content
    if (description) {
      if (meta) meta.content = description
      else add('meta', { name: 'description', content: description })
    }
    if (canonical) add('link', { rel: 'canonical', href: canonical })
    for (const [lang, href] of Object.entries(alternates)) add('link', { rel: 'alternate', hreflang: lang, href })
    if (noindex) add('meta', { name: 'robots', content: 'noindex' })

    return () => {
      for (const element of added) element.remove()
      if (meta && previous !== undefined) meta.content = previous
    }
  }, [key])
}
