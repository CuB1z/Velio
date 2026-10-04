/** Provoca la descarga de un blob ya obtenido con las cabeceras de sesión. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Sin revoke el blob se queda en memoria hasta recargar la pestaña.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** "Algete 70 · Vellón" → "algete-70-vellon". Evita nombres de fichero rotos. */
export function slugify(value: string, fallback = 'ruta'): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || fallback
}
