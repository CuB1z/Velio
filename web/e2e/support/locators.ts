import type { Locator } from '@playwright/test'

export const visible = (locator: Locator) => locator.filter({ visible: true }).first()
