import { useEffect } from 'react'

type Social = { title: string; description: string; url: string; image: string; imageAlt: string; locale: string }

type DocumentHead = {
  description?: string
  canonical?: string
  alternates?: Record<string, string>
  noindex?: boolean
  social?: Social
}

const MANAGED =
  'link[rel="canonical"], link[rel="alternate"][hreflang], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"]'

export function useDocumentHead(head: DocumentHead): void {
  const key = JSON.stringify(head)

  useEffect(() => {
    const { description, canonical, alternates = {}, noindex, social } = JSON.parse(key) as DocumentHead
    for (const stale of document.head.querySelectorAll(MANAGED)) stale.remove()
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
    if (social) {
      const og = {
        type: 'website',
        site_name: 'Velio',
        title: social.title,
        description: social.description,
        url: social.url,
        image: social.image,
        'image:alt': social.imageAlt,
        locale: social.locale,
      }
      for (const [property, content] of Object.entries(og)) add('meta', { property: `og:${property}`, content })
      add('meta', { name: 'twitter:card', content: 'summary_large_image' })
    }

    return () => {
      for (const element of added) element.remove()
      if (meta && previous !== undefined) meta.content = previous
    }
  }, [key])
}
