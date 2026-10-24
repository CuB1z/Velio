import { useEffect, useState } from 'react'

function scrollParent(element: Element): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

export function useActiveSection(ids: readonly string[], ratio = 0.4): string | null {
  const key = ids.join(',')
  const [active, setActive] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    const sections = key
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    if (sections.length === 0) return

    const container = scrollParent(sections[0])
    const scroller: EventTarget = container ?? window
    let frame = 0

    const measure = () => {
      frame = 0
      const top = container ? container.getBoundingClientRect().top : 0
      const height = container ? container.clientHeight : window.innerHeight
      const scrollTop = container ? container.scrollTop : window.scrollY
      const scrollHeight = container ? container.scrollHeight : document.documentElement.scrollHeight
      const atBottom = scrollHeight > height && scrollTop + height >= scrollHeight - 1
      const line = top + height * ratio
      let current = sections[0]
      for (const section of sections) {
        if (section.getBoundingClientRect().top < line) current = section
      }
      const target = sections.find((section) => `#${section.id}` === window.location.hash)
      const targetTop = target?.getBoundingClientRect().top ?? -Infinity
      const targetVisible = targetTop >= top - 1 && targetTop < top + height
      const bottom = target && targetVisible ? target : sections[sections.length - 1]
      setActive((atBottom ? bottom : current).id)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    schedule()
    scroller.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      scroller.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [key, ratio])

  return active
}
