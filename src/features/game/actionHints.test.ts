import { describe, expect, it } from 'vitest'
import { getLegalActions, type GameState } from '../../engine'
import { act, setup } from '../../engine/test-helpers'
import { declareHint, drawDeckHint, endTurnHint, playDuoHint, takeDiscardHint, turnText } from './actionHints'

function hintsFor(state: GameState, uid: string) {
  return { state, legal: getLegalActions(state, uid) }
}

describe('動作停用原因', () => {
  it('[S3-3] 不是自己的回合時，所有動作停用並說明現在輪到誰', () => {
    const { state, legal } = hintsFor(setup({ phase: 'draw', discards: [['shell-1'], []] }), 'b')
    for (const hint of [
      drawDeckHint(state, legal),
      takeDiscardHint(state, legal, 0),
      playDuoHint(state, legal, []),
      declareHint(state, 'b', legal),
      endTurnHint(state, legal),
    ]) {
      expect(hint).toEqual({ enabled: false, reason: '還沒輪到你，現在是 Amy 的回合' })
    }
    expect(turnText(state, 'b')).toBe('輪到 Amy')
  })

  it('[S3-3] 取牌階段：空的棄牌堆不能拿，取牌前不能打出、宣告或結束回合', () => {
    const { state, legal } = hintsFor(setup({ phase: 'draw', discards: [['shell-1'], []] }), 'a')
    expect(drawDeckHint(state, legal).enabled).toBe(true)
    expect(takeDiscardHint(state, legal, 0).enabled).toBe(true)
    expect(takeDiscardHint(state, legal, 1)).toEqual({ enabled: false, reason: '這個棄牌堆是空的' })
    expect(playDuoHint(state, legal, []).reason).toBe('要先抽牌庫或拿一張棄牌堆頂牌')
    expect(endTurnHint(state, legal).reason).toBe('要先抽牌庫或拿一張棄牌堆頂牌')
  })

  it('[S3-3] 選留牌與螃蟹挑牌時，取牌按鈕說明要先完成哪一步', () => {
    const chosen = act(setup({ phase: 'draw' }), 'a', { type: 'DRAW_DECK' })
    const c = hintsFor(chosen, 'a')
    expect(drawDeckHint(c.state, c.legal).reason).toBe('要先決定留下哪一張')
    expect(takeDiscardHint(c.state, c.legal, 0).reason).toBe('要先決定留下哪一張')

    const crab = act(setup({ hands: [['crab-1', 'crab-2']], discards: [['shell-1'], []] }), 'a', {
      type: 'PLAY_DUO',
      cardIds: ['crab-1', 'crab-2'],
      crab: { pile: 0 },
    })
    const k = hintsFor(crab, 'a')
    expect(drawDeckHint(k.state, k.legal).reason).toBe('要先從棄牌堆挑一張')
    expect(takeDiscardHint(k.state, k.legal, 1).reason).toBe('要先從棄牌堆挑一張')
  })

  it('[S3-3] 牌庫空時不能抽牌庫', () => {
    const { state, legal } = hintsFor(setup({ phase: 'draw', deck: [], discards: [['shell-1'], []] }), 'a')
    expect(drawDeckHint(state, legal)).toEqual({ enabled: false, reason: '牌庫沒有牌了' })
  })

  it('[S3-3] 打出 duo 需要選到兩張可配對的手牌', () => {
    const { state, legal } = hintsFor(setup({ hands: [['crab-1', 'crab-2', 'shell-1']] }), 'a')
    expect(playDuoHint(state, legal, ['crab-1']).reason).toBe('先點選兩張可以配對的手牌')
    expect(playDuoHint(state, legal, ['crab-1', 'shell-1']).reason).toBe('這兩張不能配成一對')
    expect(playDuoHint(state, legal, ['crab-2', 'crab-1']).enabled).toBe(true)
    expect(drawDeckHint(state, legal).reason).toBe('這回合已經取過牌了')
  })

  it('[S3-3] 卡牌分未滿 7 分不能宣告，並顯示目前分數；已有人宣告也不能', () => {
    const low = hintsFor(setup({ hands: [['shell-1', 'shell-2', 'shell-3', 'shell-4']] }), 'a')
    expect(declareHint(low.state, 'a', low.legal).reason).toBe('卡牌分需達 7 分才能宣告（目前 6 分）')

    const high = hintsFor(setup({ hands: [['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5']] }), 'a')
    expect(declareHint(high.state, 'a', high.legal).enabled).toBe(true)

    const declared = act(high.state, 'a', { type: 'DECLARE', kind: 'lastChance' })
    const next = hintsFor({ ...declared, phase: 'actions' }, 'b')
    expect(declareHint(next.state, 'b', next.legal).reason).toBe('本局已經有人宣告了')
  })
})
