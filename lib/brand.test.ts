import { describe, it, expect } from 'vitest'
import {
  AB_BRAND_NAME,
  ET_BRAND_NAME,
  ET_PLATFORM_HEADER,
  ET_PLATFORM_VALUE,
  brandName,
  compactBrandName,
  isEthioTaxHeader,
  isEthioTaxJobPlatform,
  isEthioTaxBrowser,
} from './brand'

// The one brand-name source for template text (owner decision D248: on
// EthioTax the brand name becomes "EthioTax"; every other word stays).

const headersOf = (value: string | null) => ({ get: (name: string) => (name === 'x-et-platform' ? value : null) })

describe('brand names', () => {
  it('names each brand', () => {
    expect(AB_BRAND_NAME).toBe('Accounting Body')
    expect(ET_BRAND_NAME).toBe('EthioTax')
    expect(brandName(false)).toBe('Accounting Body')
    expect(brandName(true)).toBe('EthioTax')
  })

  it('keeps the joined spelling for Accounting Body text that uses it', () => {
    expect(compactBrandName(false)).toBe('AccountingBody')
    expect(compactBrandName(true)).toBe('EthioTax')
  })
})

describe('isEthioTaxHeader', () => {
  it('reads the same header and value as the root layout', () => {
    expect(ET_PLATFORM_HEADER).toBe('x-et-platform')
    expect(ET_PLATFORM_VALUE).toBe('ethiotax')
    expect(isEthioTaxHeader(headersOf('ethiotax'))).toBe(true)
  })

  it('is Accounting Body for a missing or any other value', () => {
    expect(isEthioTaxHeader(headersOf(null))).toBe(false)
    expect(isEthioTaxHeader(headersOf('ab'))).toBe(false)
    expect(isEthioTaxHeader(headersOf('EthioTax'))).toBe(false)
    expect(isEthioTaxHeader(headersOf(''))).toBe(false)
  })
})

describe('isEthioTaxJobPlatform', () => {
  it('is EthioTax only for a job shown on EthioTax alone', () => {
    expect(isEthioTaxJobPlatform(['et'])).toBe(true)
    expect(isEthioTaxJobPlatform('et')).toBe(true)
  })

  it('is Accounting Body for shared, Accounting Body, empty or unknown platforms', () => {
    expect(isEthioTaxJobPlatform(['ab', 'et'])).toBe(false)
    expect(isEthioTaxJobPlatform(['ab'])).toBe(false)
    expect(isEthioTaxJobPlatform([])).toBe(false)
    expect(isEthioTaxJobPlatform(null)).toBe(false)
    expect(isEthioTaxJobPlatform(undefined)).toBe(false)
    expect(isEthioTaxJobPlatform('')).toBe(false)
    expect(isEthioTaxJobPlatform(['ethiotax'])).toBe(false)
    expect(isEthioTaxJobPlatform(42)).toBe(false)
  })
})

describe('isEthioTaxBrowser', () => {
  it('follows the platform cookie the middleware sets', () => {
    expect(isEthioTaxBrowser('a=1; x-et-platform=ethiotax; b=2', 'example.vercel.app')).toBe(true)
    expect(isEthioTaxBrowser('x-et-platform=ab', 'accountingbody.com')).toBe(false)
  })

  it('also recognises the EthioTax host', () => {
    expect(isEthioTaxBrowser('', 'ethiotax.com')).toBe(true)
    expect(isEthioTaxBrowser('', 'www.ethiotax.com')).toBe(true)
  })

  it('is Accounting Body otherwise', () => {
    expect(isEthioTaxBrowser('', 'accountingbody.com')).toBe(false)
    expect(isEthioTaxBrowser('other-x-et-platform=ethiotax', 'accountingbody.com')).toBe(false)
  })
})
