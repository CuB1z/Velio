import { useEffect } from 'react'

type Social = { title: string; description: string; url: string; image: string; imageAlt: string; locale: string }

type DocumentHead = {
  title?: string
  description?: string
  canonical?: string
  alternates?: Record<string, string>
  noindex?: boolean
  social?: Social
  jsonLd?: Record<string, unknown>
}

const MANAGED =
  'link[rel="canonical"], link[rel="alternate"][hreflang], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], script[type="application/ld+json"]'

export function useDocumentHead(head: DocumentHead): void {
  const key = JSON.stringify(head)

  useEffect(() => {
    const { title, description, canonical, alternates = {}, noindex, social, jsonLd } = JSON.parse(key) as DocumentHead
    for (const stale of document.head.querySelectorAll(MANAGED)) stale.remove()
    const added: Element[] = []
    const add = (tag: string, attrs: Record<string, string>) => {
      const element = document.createElement(tag)
      for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value)
      document.head.append(element)
      added.push(element)
    }

    const previousTitle = document.title
    if (title) document.title = title
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
        'image:width': '1200',
        'image:height': '630',
        'image:alt': social.imageAlt,
        locale: social.locale,
      }
      for (const [property, content] of Object.entries(og)) add('meta', { property: `og:${property}`, content })
      add('meta', { name: 'twitter:card', content: 'summary_large_image' })
    }
    if (jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(jsonLd)
      document.head.append(script)
      added.push(script)
    }

    return () => {
      for (const element of added) element.remove()
      document.title = previousTitle
      if (meta && previous !== undefined) meta.content = previous
    }
  }, [key])
}
