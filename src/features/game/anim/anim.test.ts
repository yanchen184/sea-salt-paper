import { describe, expect, it } from 'vitest'
import type { Action, GameState } from '../../../engine'
import { act, card, setup } from '../../../engine/test-helpers'
import { planAnimation } from './plan'
import { animReducer, initAnim, type AnimState } from './queue'

function last(state: GameState) {
  const e = state.events[state.events.length - 1]
  if (!e) throw new Error('沒有事件')
  return e
}

function after(state: GameState, playerId: string, action: Action) {
  const next = act(state, playerId, action)
  return { before: state, next, event: last(next) }
}

describe('S8 動畫規劃', () => {
  it('[S8-2] 抽牌庫：對手看到 2 張牌背從牌庫飛到抽牌者座位，抽牌者自己看到牌背途中翻成正面', () => {
    const { before, event } = after(setup({ phase: 'draw', deck: ['fish-1', 'fish-2'] }), 'a', { type: 'DRAW_DECK' })
    expect(planAnimation(event, before, 'b')).toEqual([
      {
        flights: [
          { from: 'deck', to: 'seat-a', card: null, flip: false },
          { from: 'deck', to: 'seat-a', card: null, flip: false },
        ],
        spread: null,
        banner: null,
      },
    ])
    expect(planAnimation(event, before, 'a')[0]?.flights).toEqual([
      { from: 'deck', to: 'hand', card: card('fish-1'), flip: true },
      { from: 'deck', to: 'hand', card: card('fish-2'), flip: true },
    ])
  })

  it('[S8-2] 留牌：另一張從抽牌者飛到所選棄牌堆，對手看到途中翻成正面', () => {
    const drawn = act(setup({ phase: 'draw', deck: ['fish-1', 'fish-2'] }), 'a', { type: 'DRAW_DECK' })
    const { before, event } = after(drawn, 'a', { type: 'KEEP_DRAWN', keepCardId: 'fish-1', discardPile: 1 })
    expect(planAnimation(event, before, 'b')[0]?.flights).toEqual([{ from: 'seat-a', to: 'pile-1', card: card('fish-2'), flip: true }])
    expect(planAnimation(event, before, 'a')[0]?.flights).toEqual([{ from: 'drawn', to: 'pile-1', card: card('fish-2'), flip: false }])
  })

  it('[S8-3] 拿棄牌堆：頂牌從該堆飛到拿牌者', () => {
    const { before, event } = after(setup({ phase: 'draw', discards: [['shell-1'], ['crab-1']] }), 'a', { type: 'TAKE_DISCARD', pile: 1 })
    expect(planAnimation(event, before, 'b')[0]?.flights).toEqual([{ from: 'pile-1', to: 'seat-a', card: card('crab-1'), flip: false }])
  })

  it('[S8-4] 打 Duo：先 2 張落到場上（對手看到途中翻成正面），再播效果', () => {
    const fish = after(setup({ hands: [['fish-1', 'fish-2']], deck: ['shell-1'] }), 'a', { type: 'PLAY_DUO', cardIds: ['fish-1', 'fish-2'] })
    const stages = planAnimation(fish.event, fish.before, 'b')
    expect(stages.map((s) => s.flights)).toEqual([
      [
        { from: 'seat-a', to: 'field-a', card: card('fish-1'), flip: true },
        { from: 'seat-a', to: 'field-a', card: card('fish-2'), flip: true },
      ],
      [{ from: 'deck', to: 'seat-a', card: null, flip: false }],
    ])
    expect(planAnimation(fish.event, fish.before, 'a')[0]?.flights.map((f) => f.flip)).toEqual([false, false])
    const fishEmpty = after(setup({ hands: [['fish-1', 'fish-2']], deck: [] }), 'a', { type: 'PLAY_DUO', cardIds: ['fish-1', 'fish-2'] })
    expect(planAnimation(fishEmpty.event, fishEmpty.before, 'b')).toHaveLength(1)

    const steal = after(setup({ hands: [['shark-1', 'swimmer-1'], ['shell-1']] }), 'a', {
      type: 'PLAY_DUO',
      cardIds: ['shark-1', 'swimmer-1'],
      steal: { targetId: 'b' },
    })
    expect(planAnimation(steal.event, steal.before, 'b')[1]?.flights).toEqual([{ from: 'hand', to: 'seat-a', card: null, flip: false }])
    expect(planAnimation(steal.event, steal.before, 'c')[1]?.flights).toEqual([{ from: 'seat-b', to: 'seat-a', card: null, flip: false }])

    const boat = after(setup({ hands: [['boat-1', 'boat-2']] }), 'a', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    expect(planAnimation(boat.event, boat.before, 'b')[1]?.banner).toBe('Amy 獲得額外回合')
  })

  it('[S8-4] 螃蟹：該棄牌堆的牌全部正面攤開，挑到的牌以牌背飛到挑牌者', () => {
    const played = after(setup({ hands: [['crab-1', 'crab-2']], discards: [['shell-1', 'mermaid-1'], []] }), 'a', {
      type: 'PLAY_DUO',
      cardIds: ['crab-1', 'crab-2'],
      crab: { pile: 0 },
    })
    expect(planAnimation(played.event, played.before, 'b')[1]).toEqual({
      flights: [],
      spread: { zone: 'pile-0', cards: [card('shell-1'), card('mermaid-1')] },
      banner: null,
    })
    const picked = after(played.next, 'a', { type: 'PICK_CRAB', cardId: 'mermaid-1' })
    expect(planAnimation(picked.event, picked.before, 'b')).toEqual([
      { flights: [{ from: 'pile-0', to: 'seat-a', card: null, flip: false }], spread: null, banner: null },
    ])
  })

  it('[S8-5] 宣告：顯示宣告者與種類', () => {
    const shells = ['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5']
    const { before, event } = after(setup({ hands: [shells, ['fish-1']] }), 'a', { type: 'DECLARE', kind: 'stop' })
    expect(planAnimation(event, before, 'b')[0]?.banner).toBe('Amy 宣告 STOP')
  })
})

describe('S8 動畫佇列', () => {
  const start = setup({ phase: 'draw', discards: [['shell-1'], ['crab-1']], deck: ['fish-1', 'fish-2', 'fish-3'] })
  const s1 = act(start, 'a', { type: 'TAKE_DISCARD', pile: 1 })
  const s2 = act(s1, 'a', { type: 'END_TURN' })
  const s3 = act(s2, 'b', { type: 'TAKE_DISCARD', pile: 0 })

  function receive(state: AnimState, game: GameState, enabled = true) {
    return animReducer(state, { type: 'receive', game, enabled })
  }

  it('[S8-6] 播放時停在動作前的畫面，播完才顯示新狀態', () => {
    const playing = receive(initAnim(start), s1)
    expect(playing.shown).toBe(start)
    expect(playing.playing?.seq).toBe(1)
    const done = animReducer(playing, { type: 'done', seq: 1 })
    expect(done.shown).toBe(s1)
    expect(done.playing).toBeNull()
  })

  it('[S8-6] 連續動作依序播完，中間顯示各自的快照，不跳過、不重複', () => {
    let st = receive(initAnim(start), s1)
    st = receive(st, s2)
    st = receive(st, s3)
    const played: number[] = []
    const shownAfter: GameState[] = []
    while (st.playing) {
      played.push(st.playing.seq)
      st = animReducer(st, { type: 'done', seq: st.playing.seq })
      shownAfter.push(st.shown)
    }
    expect(played).toEqual([1, 2])
    expect(shownAfter).toEqual([s2, s3])
    expect(receive(st, s3).playing).toBeNull()
  })

  it('[S8-6] 重複的 done 不會跳過下一個動作', () => {
    let st = receive(receive(initAnim(start), s1), s3)
    st = animReducer(st, { type: 'done', seq: 1 })
    expect(st.playing?.seq).toBe(2)
    st = animReducer(st, { type: 'done', seq: 1 })
    expect(st.playing?.seq).toBe(2)
  })

  it('[S8-6] 沒有新事件的快照不播動畫，直接顯示', () => {
    const st = receive(initAnim(s1), s2)
    expect(st.playing).toBeNull()
    expect(st.shown).toBe(s2)
  })

  it('[S8-7] 一次收到多個新動作（斷線補收）不播動畫，排在播放中的動作之後直接顯示', () => {
    const s4 = act(s3, 'b', { type: 'END_TURN' })
    const s5 = act(s4, 'a', { type: 'DRAW_DECK' })
    expect(s5.events.filter((e) => e.seq > 1)).toHaveLength(2)
    expect(receive(initAnim(s1), s5)).toMatchObject({ playing: null, shown: s5, pending: [] })

    let st = receive(initAnim(start), s1)
    st = receive(st, s5)
    expect(st.playing?.seq).toBe(1)
    st = animReducer(st, { type: 'done', seq: 1 })
    expect(st).toMatchObject({ playing: null, shown: s5, pending: [] })
  })

  it('[S8-7] 載入時已發生的動作不重播', () => {
    const st = initAnim(s3)
    expect(st.playing).toBeNull()
    expect(st.shown).toBe(s3)
    expect(receive(st, s3).playing).toBeNull()
  })

  it('[S8-7] 新的一場（seq 歸零）直接顯示，之後的動作照常播放', () => {
    const fresh = setup({ phase: 'draw', discards: [['shell-1'], []] })
    let st = receive(initAnim(s3), fresh)
    expect(st.shown).toBe(fresh)
    expect(st.playing).toBeNull()
    st = receive(st, act(fresh, 'a', { type: 'TAKE_DISCARD', pile: 0 }))
    expect(st.playing?.type).toBe('takeDiscard')
  })

  it('[S8-8] 關閉動畫時直接顯示新狀態，也清掉排隊中的動作', () => {
    const queued = receive(initAnim(start), s1)
    const st = receive(queued, s3, false)
    expect(st.shown).toBe(s3)
    expect(st.playing).toBeNull()
    expect(st.pending).toEqual([])
  })
})
