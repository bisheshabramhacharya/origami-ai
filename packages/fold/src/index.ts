export * from './language'
export { FoldCheckError, type FoldCheck, type FoldIssue } from './errors'
export {
  type Assignment,
  type Edge,
  type FoldRecord,
  type FoldState,
  makeSheet,
  cloneState,
  isFlat,
  isFlipped,
  faceLevels,
  foldedPositionOf,
} from './state'
export type { Vec2, Vec3 } from './geometry'
export { applyAction, type ActionResult } from './actions'
export { checkState, checkNoStretch, checkMaekawa, checkKawasaki, checkLayers } from './checks'
export {
  runFoldSequence,
  foldSequence,
  describeIssue,
  FoldSequenceError,
  type FoldedStep,
  type SequenceIssue,
  type SequenceResult,
} from './sequence'
export { toFold, fromFold, type FoldFile } from './fold-format'
export {
  displayMesh,
  boundingBox,
  outline,
  layersAt,
  stackAt,
  type DisplayMesh,
  type DisplayFace,
  type DisplayEdge,
  type DisplayEdgeKind,
  type DisplayOptions,
} from './display'
