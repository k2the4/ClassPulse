import type { Weightages } from './types';
export type InternalComponents = { assignment: number; presentation: number; attendance: number; midsem1: number; midsem2: number };
export function validateWeights(weights: Weightages) { const total = Object.values(weights).reduce((sum, value) => sum + value, 0); return Math.abs(total - 100) < 0.001; }
export function weightedInternal(components: InternalComponents, weights: Weightages) {
  const raw = components.assignment * weights.assignment_weight / 100 + components.presentation * weights.presentation_weight / 100 + components.attendance * weights.attendance_weight / 100 + components.midsem1 * weights.midsem_1_weight / 100 + components.midsem2 * weights.midsem_2_weight / 100;
  return Math.round(raw * 100) / 100;
}
export function moderatedInternal(raw: number, factor = 1, cap = 40) { return Math.min(cap, Math.round(raw * factor * 100) / 100); }
export function riskLevel(attendancePercent: number, internalMark: number) { if (attendancePercent < 50 || internalMark < 10) return 'high'; if (attendancePercent < 75 || internalMark < 20) return 'medium'; return 'low'; }
