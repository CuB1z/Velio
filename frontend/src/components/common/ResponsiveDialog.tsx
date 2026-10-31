import { Drawer, Modal, type useOverlayState } from '@heroui/react'
import { createContext, use, type ReactNode } from 'react'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'

type Props = { state: ReturnType<typeof useOverlayState>; children: ReactNode }
type PartProps = { children: ReactNode }

const PhoneContext = createContext(false)

export function ResponsiveDialog({ state, children }: Props) {
  const phone = useMediaQuery('(width < 48rem)')

  if (phone) {
    return (
      <PhoneContext value>
        <Drawer state={state}>
          <Drawer.Backdrop>
            <Drawer.Content placement="bottom">
              <Drawer.Dialog className="pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                <Drawer.Handle />
                {children}
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      </PhoneContext>
    )
  }

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>{children}</Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

function Header({ children }: PartProps) {
  const Part = use(PhoneContext) ? Drawer.Header : Modal.Header
  return <Part>{children}</Part>
}

function Heading({ children }: PartProps) {
  const Part = use(PhoneContext) ? Drawer.Heading : Modal.Heading
  return <Part>{children}</Part>
}

function Body({ className, children }: PartProps & { className?: string }) {
  const Part = use(PhoneContext) ? Drawer.Body : Modal.Body
  return <Part className={className}>{children}</Part>
}

function Footer({ children }: PartProps) {
  const phone = use(PhoneContext)
  const Part = phone ? Drawer.Footer : Modal.Footer
  return (
    <Part className={cn('flex gap-2', phone ? 'flex-col-reverse *:w-full' : 'justify-end')}>{children}</Part>
  )
}

ResponsiveDialog.Header = Header
ResponsiveDialog.Heading = Heading
ResponsiveDialog.Body = Body
ResponsiveDialog.Footer = Footer
