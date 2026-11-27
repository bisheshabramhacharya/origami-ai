import type { FinishedSize, Model } from './types'

/** The finished size for a given sheet side in mm. Folding is scale free, so every size scales linearly. */
export function finishedSizeFor(size: FinishedSize, sheetMm: number): FinishedSize {
  const k = sheetMm / size.fromSheetMm
  return { fromSheetMm: sheetMm, widthMm: size.widthMm * k, lengthMm: size.lengthMm * k, heightMm: size.heightMm * k }
}

const cm = (mm: number) => {
  const value = Math.round(mm / 5) / 2
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

/** For example "About 9 cm wide from a 15 cm sheet". Null when the Model has no finished size. */
export function finishedSizeLabel(model: Model, sheetMm?: number): string | null {
  if (!model.finishedSize) return null
  const size = finishedSizeFor(model.finishedSize, sheetMm ?? model.finishedSize.fromSheetMm)
  return `About ${cm(size.widthMm)} cm wide from a ${cm(size.fromSheetMm)} cm sheet`
}
