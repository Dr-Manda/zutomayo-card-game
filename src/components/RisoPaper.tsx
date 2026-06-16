import { ReactNode, CSSProperties, ElementType } from 'react'

interface RisoPaperProps {
  as?: 'div' | 'section' | 'main' | 'article' | 'aside'
  halftone?: 'none' | 'pink' | 'teal' | 'pink-coarse' | 'teal-coarse'
  grain?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export default function RisoPaper({
  as = 'div',
  halftone = 'none',
  grain = true,
  className = '',
  style,
  children,
}: RisoPaperProps) {
  const Tag = as as ElementType
  const halftoneClass = halftone === 'none' ? '' : `halftone-${halftone}`

  return (
    <Tag
      className={`relative ${grain ? 'bg-paper' : ''} ${className}`}
      style={style}
    >
      {halftoneClass && (
        <div
          aria-hidden
          className={`absolute inset-0 pointer-events-none ${halftoneClass}`}
          style={{ mixBlendMode: 'multiply', opacity: 0.6 }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </Tag>
  )
}
