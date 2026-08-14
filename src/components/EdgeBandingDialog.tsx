import type { EdgeBandingSides, Part, PartEdgeBanding } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { calculateEdgeBandingTotals, toggleEdgeSide } from '@/lib/edge-banding'
import { formatMeters } from '@/lib/utils'

interface EdgeBandingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parts: Part[]
  edgeBanding: PartEdgeBanding[]
  onChange: (edgeBanding: PartEdgeBanding[]) => void
}

function EdgePreview({
  part,
  mm2,
  mm05,
}: {
  part: Part
  mm2: EdgeBandingSides
  mm05: EdgeBandingSides
}) {
  const aspect = part.height / part.width
  const boxW = 80
  const boxH = Math.max(40, boxW * aspect)

  const renderLines = (sides: EdgeBandingSides, thickness: number, offset: number) => {
    const lines: React.ReactNode[] = []
    const lineCount = 3
    const gap = thickness === 2 ? 2 : 1
    const strokeW = thickness === 2 ? 1.2 : 0.6

    if (sides.top) {
      for (let i = 0; i < lineCount; i++) {
        lines.push(
          <line
            key={`top-${thickness}-${i}`}
            x1={4 + i * gap}
            y1={2 + offset}
            x2={boxW - 4 - i * gap}
            y2={2 + offset}
            stroke="#60a5fa"
            strokeWidth={strokeW}
          />,
        )
      }
    }
    if (sides.bottom) {
      for (let i = 0; i < lineCount; i++) {
        lines.push(
          <line
            key={`bottom-${thickness}-${i}`}
            x1={4 + i * gap}
            y1={boxH - 2 - offset}
            x2={boxW - 4 - i * gap}
            y2={boxH - 2 - offset}
            stroke="#60a5fa"
            strokeWidth={strokeW}
          />,
        )
      }
    }
    if (sides.left) {
      for (let i = 0; i < lineCount; i++) {
        lines.push(
          <line
            key={`left-${thickness}-${i}`}
            x1={2 + offset}
            y1={4 + i * gap}
            x2={2 + offset}
            y2={boxH - 4 - i * gap}
            stroke="#60a5fa"
            strokeWidth={strokeW}
          />,
        )
      }
    }
    if (sides.right) {
      for (let i = 0; i < lineCount; i++) {
        lines.push(
          <line
            key={`right-${thickness}-${i}`}
            x1={boxW - 2 - offset}
            y1={4 + i * gap}
            x2={boxW - 2 - offset}
            y2={boxH - 4 - i * gap}
            stroke="#60a5fa"
            strokeWidth={strokeW}
          />,
        )
      }
    }
    return lines
  }

  return (
    <svg width={boxW} height={boxH} className="mx-auto">
      <rect
        x={1}
        y={1}
        width={boxW - 2}
        height={boxH - 2}
        fill="#1e293b"
        stroke="#475569"
        strokeWidth={1}
      />
      {renderLines(mm2, 2, 0)}
      {renderLines(mm05, 0.5, 5)}
    </svg>
  )
}

function EdgeRow({
  label,
  sides,
  prefix,
  onToggle,
}: {
  label: string
  sides: EdgeBandingSides
  prefix: string
  onToggle: (side: keyof EdgeBandingSides, value: boolean) => void
}) {
  return (
    <tr className="border-b border-[var(--color-border)]/30">
      <td className="py-2 pr-2 text-xs text-[var(--color-muted-foreground)]">{label}</td>
      <td className="py-2">
        <div className="flex justify-center gap-4">
          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              id={`${prefix}-left`}
              checked={sides.left}
              onCheckedChange={(c) => onToggle('left', c === true)}
            />
            <span>Дълж. Л</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              id={`${prefix}-right`}
              checked={sides.right}
              onCheckedChange={(c) => onToggle('right', c === true)}
            />
            <span>Дълж. Д</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              id={`${prefix}-top`}
              checked={sides.top}
              onCheckedChange={(c) => onToggle('top', c === true)}
            />
            <span>Шир. Г</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              id={`${prefix}-bottom`}
              checked={sides.bottom}
              onCheckedChange={(c) => onToggle('bottom', c === true)}
            />
            <span>Шир. Д</span>
          </label>
        </div>
      </td>
    </tr>
  )
}

export function EdgeBandingDialog({
  open,
  onOpenChange,
  parts,
  edgeBanding,
  onChange,
}: EdgeBandingDialogProps) {
  const totals = calculateEdgeBandingTotals(parts, edgeBanding)

  const updateBand = (partId: string, thickness: 'mm2' | 'mm05', side: keyof EdgeBandingSides, value: boolean) => {
    onChange(
      edgeBanding.map((b) =>
        b.partId === partId ? toggleEdgeSide(b, thickness, side, value) : b,
      ),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Кантиране</DialogTitle>
          <DialogDescription>
            По 2 реда на детайл — 2 мм и 0.5 мм. Дължините се изчисляват в метри.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex gap-6 rounded-md bg-[var(--color-secondary)] p-3 text-sm">
          <span>
            2 мм кант: <strong>{formatMeters(totals.mm2)}</strong>
          </span>
          <span>
            0.5 мм кант: <strong>{formatMeters(totals.mm05)}</strong>
          </span>
        </div>

        <div className="space-y-6">
          {parts.map((part) => {
            const band = edgeBanding.find((b) => b.partId === part.id)
            if (!band) return null

            return (
              <div
                key={part.id}
                className="rounded-lg border border-[var(--color-border)] p-3"
              >
                <div className="mb-3 flex items-center gap-4">
                  <EdgePreview part={part} mm2={band.mm2} mm05={band.mm05} />
                  <div>
                    <p className="font-medium">
                      {part.width} × {part.height} мм
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      × {part.quantity} бр.
                    </p>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <tbody>
                    <EdgeRow
                      label="2 мм"
                      sides={band.mm2}
                      prefix={`${part.id}-2`}
                      onToggle={(side, value) => updateBand(part.id, 'mm2', side, value)}
                    />
                    <EdgeRow
                      label="0.5 мм"
                      sides={band.mm05}
                      prefix={`${part.id}-05`}
                      onToggle={(side, value) => updateBand(part.id, 'mm05', side, value)}
                    />
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
