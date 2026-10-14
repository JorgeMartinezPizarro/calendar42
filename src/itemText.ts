// Nombre y descripción de un elemento en el idioma de la app. Los eventos y
// exámenes llevan los de la intra tal cual (los escribe cada campus); lo que
// genera Calendar42 (slots, franjas libres, correcciones y los datos de un
// examen) se redacta aquí con los datos que manda la API. Si faltan esos datos
// (copia local de una versión anterior), se usa el texto que trae.

import { t } from './i18n/index.ts'
import type { Item } from './types.ts'

export function itemName(item: Item): string {
  switch (item.type) {
    case 'slot':
      return t.items.openSlot
    case 'free':
      return item.corrector?.login ? t.items.freeSlotOf(item.corrector.login) : t.items.freeSlot
    case 'correction':
      return item.correctionInfo ? t.items.correction(item.correctionInfo.project) : item.name
    default:
      return item.name
  }
}

export function itemDescription(item: Item): string {
  const blocks = item.slotIds?.length ?? 0
  switch (item.type) {
    case 'slot':
      return blocks ? t.items.slotDescription(blocks) : item.description
    case 'free': {
      const text = blocks ? t.items.freeDescription(blocks) : item.description
      return item.evaluationMinutes ? `${text}\n${t.items.evaluationLasts(item.evaluationMinutes)}` : text
    }
    case 'correction': {
      const info = item.correctionInfo
      if (!info) return item.description
      const lines = [item.role === 'corrector' ? t.items.youEvaluate : t.items.youAreEvaluated]
      if (info.corrector) lines.push(`${t.items.corrector}: ${info.corrector}`)
      if (info.correcteds.length) lines.push(`${t.items.correcteds}: ${info.correcteds.join(', ')}`)
      if (info.team) lines.push(`${t.items.team}: ${info.team}`)
      if (item.done && info.mark != null) lines.push(t.items.evaluationDone(info.mark))
      if (info.bookedHere) lines.push(t.items.bookedHere)
      return lines.join('\n')
    }
    case 'exam': {
      const info = item.examInfo
      if (!info) return item.description
      const lines: string[] = []
      if (info.projects.length) lines.push(`${t.items.examProjects}: ${info.projects.join(', ')}`)
      if (info.cursus.length) lines.push(`${t.items.examCursus}: ${info.cursus.join(', ')}`)
      if (info.ipRange) lines.push(`${t.items.examIp}: ${info.ipRange}`)
      return lines.join('\n')
    }
    default:
      return item.description
  }
}
