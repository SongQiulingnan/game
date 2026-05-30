import type { Point } from '../types'

export const SCALE = 100
export const OFFSET_X = 80
export const OFFSET_Y = 170

export const POSITION_VALUES: Record<string, number> = {
  '2,2': 35,
  '2,1': 22,
  '1,2': 22,
  '3,2': 22,
  '2,3': 22,
  '2,0': 18,
  '0,2': 18,
  '4,2': 18,
  '2,4': 18,
  '1,1': 15,
  '3,1': 15,
  '1,3': 15,
  '3,3': 15,
  '2,-1': 12,
  '1,-1': 12,
  '3,-1': 12,
  '2,-2': 12,
}

export const MAIN_POINTS: Point[] = []
for (let i = 0; i < 5; i++) {
  for (let j = 0; j < 5; j++) {
    MAIN_POINTS.push({ x: i, y: j, type: 'main' })
  }
}

export const DIAMOND_POINTS: Point[] = [
  { x: 2, y: -1, type: 'diamond' },
  { x: 1, y: -1, type: 'diamond' },
  { x: 3, y: -1, type: 'diamond' },
  { x: 2, y: -2, type: 'diamond' },
]

export const ALL_POINTS: Point[] = [...MAIN_POINTS, ...DIAMOND_POINTS]