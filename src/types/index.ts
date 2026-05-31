export type PieceColor = 'black' | 'white'

export type MoveMode = 'single' | 'multi'

export interface Point {
  x: number
  y: number
  type: 'main' | 'diamond'
}

export interface BoardState {
  [key: string]: PieceColor
}

export interface Reserves {
  black: number
  white: number
}

export interface GameState {
  board: BoardState
  reserves: Reserves
  currentPlayer: PieceColor
  selectedPiece: Point | null
  gameOver: boolean
  winner: PieceColor | null
  moveMode: MoveMode
  revivalMode: boolean
}

export interface Move {
  from: Point
  to: Point
}

export interface Capture {
  type: '夹' | '挑'
  points: Point[]
}

export type AILevel = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type AIEvaluationType = 'random' | 'greedy' | 'basic' | 'standard' | 'advanced' | 'master' | 'threat'

export interface AILevelConfig {
  name: string
  description: string
  depth: number
  thinkingTime: number
  evaluationType: AIEvaluationType
  moveOrdering: boolean
  chainCaptureAware: boolean
  revivalAware: boolean
  drawAware: boolean
  randomFactor: number
}