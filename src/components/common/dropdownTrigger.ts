import { buttonVariants } from '@heroui/react'

import { cn } from '@/lib/cn'

type ButtonOptions = Parameters<typeof buttonVariants>[0]

/**
 * Clases para un Dropdown.Trigger con aspecto de botón.
 *
 * Dos trampas que costaron encontrar:
 *
 * 1. Dropdown.Trigger YA renderiza el <button>. Meter un <Button> de HeroUI
 *    dentro produce <button><button>, que es HTML inválido y React avisa.
 *    Por eso las clases del botón se le pasan al propio trigger.
 *
 * 2. Pero `.dropdown__trigger` impone `display: block` y gana a `.button`, que
 *    es inline-flex. Sin devolver el flex aquí, `justify-center` no hace nada y
 *    el icono se queda pegado al borde izquierdo mientras el fondo del hover
 *    ocupa el botón entero: parece que el hover esté desplazado.
 */
export function dropdownTriggerClass(options: ButtonOptions, extra?: string): string {
  return cn(buttonVariants(options), 'inline-flex items-center justify-center', extra)
}
