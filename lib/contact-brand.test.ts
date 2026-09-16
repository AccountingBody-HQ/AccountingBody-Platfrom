import { describe, it, expect } from 'vitest'
import {
  getContactBrand,
  contactPlatformValue,
  isEthioTaxPlatformValue,
  AB_CONTACT_BRAND,
  ET_CONTACT_BRAND,
  CONTACT_SENDER_EMAIL,
} from './contact-brand'

describe('getContactBrand', () => {
  it('returns the EthioTax brand when isET is true', () => {
    expect(getContactBrand(true)).toBe(ET_CONTACT_BRAND)
    expect(getContactBrand(true).name).toBe('EthioTax')
  })

  it('returns the Accounting Body brand when isET is false', () => {
    expect(getContactBrand(false)).toBe(AB_CONTACT_BRAND)
    expect(getContactBrand(false).name).toBe('Accounting Body')
  })

  it('both brands use the one Resend-verified sending domain', () => {
    expect(AB_CONTACT_BRAND.email).toBe(CONTACT_SENDER_EMAIL)
    expect(ET_CONTACT_BRAND.email).toBe(CONTACT_SENDER_EMAIL)
    expect(CONTACT_SENDER_EMAIL).toBe('info@accountingbody.com')
  })

  it('brand colours differ per brand', () => {
    expect(AB_CONTACT_BRAND.color).not.toBe(ET_CONTACT_BRAND.color)
  })
})

describe('contactPlatformValue', () => {
  it('returns "et" for EthioTax', () => {
    expect(contactPlatformValue(true)).toBe('et')
  })

  it('returns "ab" for AccountingBody', () => {
    expect(contactPlatformValue(false)).toBe('ab')
  })
})

describe('isEthioTaxPlatformValue', () => {
  it('recognises "et" (the stored/admin-filter spelling)', () => {
    expect(isEthioTaxPlatformValue('et')).toBe(true)
  })

  it('recognises "ethiotax" (the x-et-platform header spelling)', () => {
    expect(isEthioTaxPlatformValue('ethiotax')).toBe(true)
  })

  it('rejects "ab" and other AccountingBody-ish values', () => {
    expect(isEthioTaxPlatformValue('ab')).toBe(false)
    expect(isEthioTaxPlatformValue('accountingbody')).toBe(false)
  })

  it('rejects undefined, null, and non-string values', () => {
    expect(isEthioTaxPlatformValue(undefined)).toBe(false)
    expect(isEthioTaxPlatformValue(null)).toBe(false)
    expect(isEthioTaxPlatformValue(42)).toBe(false)
    expect(isEthioTaxPlatformValue({})).toBe(false)
  })

  it('is case-sensitive (only the exact expected spellings match)', () => {
    expect(isEthioTaxPlatformValue('ET')).toBe(false)
    expect(isEthioTaxPlatformValue('EthioTax')).toBe(false)
  })
})
