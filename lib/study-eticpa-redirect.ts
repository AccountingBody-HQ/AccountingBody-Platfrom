// ETICPA study addresses are EthioTax only (owner decisions D318, D327). On
// Accounting Body an article reached as /study/<eticpa…>/<slug> has its page
// at /articles/<slug>; on EthioTax nothing changes. `slug` is the article's
// stored slug. Returns the path to redirect to, or null.
// Pure, no imports.
export function studyEticpaRedirect(isEthioTax: boolean, category: string, slug: string): string | null {
  if (isEthioTax) return null
  return category.trim().toLowerCase().startsWith('eticpa') ? `/articles/${slug}` : null
}
