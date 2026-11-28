// Professional body names that never appear in published text (owner
// decision D373, call A). ETICPA and the Institute of Certified Public
// Accountants of Ethiopia are allowed: the site's ETICPA pages name it.

export const BODY_NAMES: readonly string[] = [
  'ACCA',
  'CIMA',
  'ICAEW',
  'AAT',
  'Association of Chartered Certified Accountants',
  'Chartered Institute of Management Accountants',
  'Institute of Chartered Accountants in England and Wales',
  'Association of Accounting Technicians',
]

export const BODY_NAME_RULE = 'Never name ACCA, CIMA, ICAEW or AAT (or their full names) in the content; write for the level described, not for a named body.'

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Acronyms match case-sensitively as whole words; full names match in any case.
const MATCHERS: readonly { name: string; pattern: RegExp }[] = BODY_NAMES.map(name => {
  const acronym = /^[A-Z]+$/.test(name)
  return {
    name,
    pattern: acronym
      ? new RegExp('(^|[^A-Za-z0-9])' + escapeForRegExp(name) + '(?![A-Za-z0-9])', 'g')
      : new RegExp(escapeForRegExp(name).replace(/ /g, '\\s+'), 'gi'),
  }
})

/** Every body name found in a text, in the order of BODY_NAMES. */
export function findBodyNames(text: string): string[] {
  const found: string[] = []
  for (const { name, pattern } of MATCHERS) {
    pattern.lastIndex = 0
    if (pattern.test(text)) found.push(name)
  }
  return found
}
