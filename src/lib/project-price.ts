import {
  explainCabinetsPrice,
  generateCabinet,
  getCabinetType,
  scaleCabinetResult,
  type CabinetInstance,
} from '@/lib/cabinets'
import { isCombinationType } from '@/lib/cabinets/compose'
import type { AssemblyTimeSettings } from '@/lib/assembly-time'
import type { HardwareSettings } from '@/lib/settings'
import type { Sheet } from '@/types'

/** The whole project's price, the same total the cabinet list shows under "Обща цена". */
export function projectPriceEur(
  cabinets: CabinetInstance[],
  sheets: Sheet[],
  settings: { hardware: HardwareSettings; assemblyTime: AssemblyTimeSettings },
  dailyRateEur: number,
): number | null {
  const rows = cabinets.flatMap((cabinet) => {
    if (isCombinationType(cabinet.typeId)) return []
    try {
      const result = scaleCabinetResult(generateCabinet(cabinet.typeId, cabinet.params, settings), cabinet.quantity)
      return [
        {
          label: getCabinetType(cabinet.typeId)?.name ?? cabinet.name,
          panels: result.panels,
          hardware: result.hardware,
          assemblyMinutes: result.labor.assemblyMinutes,
          assemblySteps: result.labor.assemblySteps,
        },
      ]
    } catch {
      return []
    }
  })
  if (rows.length === 0) return null
  return explainCabinetsPrice(rows, dailyRateEur, sheets, settings.hardware).totalEur
}
