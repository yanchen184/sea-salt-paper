import { describe, expect, it } from 'vitest'
import { isValidNickname, normalizeNickname } from './nickname'
import { isOffline, OFFLINE_AFTER_MS } from './presence'
import { generateRoomCode, isRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET } from './roomCode'

describe('在線狀態', () => {
  const now = 1_000_000
  it('[A5-2] 沒有心跳紀錄視為離線', () => {
    expect(isOffline(null, now)).toBe(true)
    expect(isOffline(undefined, now)).toBe(true)
  })
  it('[A5-2] 45 秒內有心跳為在線，超過 45 秒為離線', () => {
    expect(isOffline(now - OFFLINE_AFTER_MS, now)).toBe(false)
    expect(isOffline(now - OFFLINE_AFTER_MS - 1, now)).toBe(true)
    expect(isOffline(now - 1000, now)).toBe(false)
  })
})

describe('房號', () => {
  it('4 碼，不含 0 O 1 I', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[0O1I]/)
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode()
      expect(isRoomCode(code)).toBe(true)
    }
    expect(generateRoomCode(new Uint32Array([0, 1, 2, ROOM_CODE_ALPHABET.length]))).toBe('ABCA')
  })
  it('輸入正規化', () => {
    expect(normalizeRoomCode(' ab2c ')).toBe('AB2C')
    expect(isRoomCode('AB0C')).toBe(false)
    expect(isRoomCode('ABC')).toBe(false)
  })
})

describe('暱稱', () => {
  it('[A1-1] 去掉前後空白後 1–12 字', () => {
    expect(isValidNickname(normalizeNickname('   '))).toBe(false)
    expect(isValidNickname(normalizeNickname(' 小明 '))).toBe(true)
    expect(isValidNickname('一二三四五六七八九十一二')).toBe(true)
    expect(isValidNickname('一二三四五六七八九十一二三')).toBe(false)
  })
})
