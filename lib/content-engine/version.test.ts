import { describe, expect, it } from 'vitest'
import { ENGINE_NAME, ENGINE_VERSION } from './version'

describe('engine version', () => {
  it('is named ab-content-engine', () => {
    expect(ENGINE_NAME).toBe('ab-content-engine')
  })

  it('is version 1.0.0', () => {
    expect(ENGINE_VERSION).toBe('1.0.0')
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
