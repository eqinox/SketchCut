import { useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'

type InputProps = ComponentProps<typeof Input>

/**
 * Keeps the digits as typed. The size is applied when the field is left,
 * so a first digit such as 1 is not calculated before the rest is written.
 */
export function DraftNumber({
  value,
  onCommit,
  onFocus,
  onBlur,
  onKeyDown,
  inputMode = 'decimal',
  ...rest
}: Omit<InputProps, 'value' | 'onChange' | 'type'> & {
  value: number | string
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value == null || value === '' ? '' : String(value))
  const commit = (rawText: string) => {
    const raw = rawText.trim().replace(',', '.')
    setText(null)
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    const current = Number(String(value).trim().replace(',', '.'))
    if (n === current) return
    onCommit(n)
  }
  return (
    <Input
      {...rest}
      type="text"
      inputMode={inputMode}
      value={shown}
      onFocus={(event) => {
        event.currentTarget.select()
        onFocus?.(event)
      }}
      onChange={(event) => {
        const next = event.target.value
        if (next === '' || /^-?\d*([.,]\d*)?$/.test(next)) setText(next)
      }}
      onBlur={(event) => {
        commit(event.currentTarget.value)
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        onKeyDown?.(event)
      }}
    />
  )
}
