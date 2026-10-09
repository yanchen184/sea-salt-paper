import { useCallback, useReducer } from 'react'
import type { GameEvent, GameState } from '../../../engine'
import { useAnimations } from '../../../lib/motion'
import { animReducer, initAnim } from './queue'

interface AnimatedGame {
  /** 要顯示的狀態；播動畫時是動作前的狀態 */
  shown: GameState
  playing: GameEvent | null
  done: (seq: number) => void
}

export function useAnimatedGame(game: GameState): AnimatedGame {
  const setting = useAnimations()
  const [state, dispatch] = useReducer(animReducer, game, initAnim)
  // 背景分頁不播動畫
  const enabled = setting && document.visibilityState === 'visible'
  if (state.received !== game || (!enabled && state.playing)) dispatch({ type: 'receive', game, enabled })
  const done = useCallback((seq: number) => dispatch({ type: 'done', seq }), [])
  return { shown: state.shown, playing: state.playing, done }
}
