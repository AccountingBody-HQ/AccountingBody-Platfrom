import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import AdminSignedOutNotice, { SignedOutMessage } from './AdminSignedOutNotice'

const LOGIN = '/test-admin-area-login'

vi.stubGlobal('React', React)

describe('signed-out notice', () => {
  const html = renderToStaticMarkup(createElement(SignedOutMessage, { loginHref: LOGIN }))

  it('is announced to screen readers', () => {
    expect(html).toContain('role="alert"')
  })

  it('says the last action was not completed', () => {
    expect(html).toContain('signed out')
    expect(html).toContain('not completed')
  })

  it('links to the sign-in page in a new tab, so an unsaved form is kept', () => {
    expect(html).toContain(`href="${LOGIN}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('can be dismissed', () => {
    expect(html).toContain('Dismiss')
  })

  it('stays hidden until a call reports signed out', () => {
    expect(renderToStaticMarkup(createElement(AdminSignedOutNotice, { loginHref: LOGIN }))).toBe('')
  })
})
