// Old WordPress addresses with more than one segment, frozen from the SEO
// redirect map (ab-control SEO_REDIRECT_MAP.md: 24 attachment pages, 13
// categories, 1 author, 14 exact-match tags). next.config.mjs serves them as
// permanent redirects. Sources have no trailing slash: Next removes the slash
// first (one 308), then the source matches (a second 308 to the target).
// Plain JavaScript so next.config.mjs can import it.

export const LEGACY_WORDPRESS_REDIRECTS = Object.freeze([
  // Attachment pages (image pages under an article) go to their parent article.
  { source: '/by-product/image-10', destination: '/study/management-accounting/by-product' },
  { source: '/communicating-management-information-tables-charts-and-commentary/image-12', destination: '/study/management-accounting/communicating-management-information-tables-charts-and-commentary' },
  { source: '/cost-equation/output-2', destination: '/study/management-accounting/cost-equation' },
  { source: '/cvp-analysis-break-even-target-profit-and-risk/image-13', destination: '/study/management-accounting/cvp-analysis-break-even-target-profit-and-risk' },
  { source: '/cvp-analysis-break-even-target-profit-and-risk/image-14', destination: '/study/management-accounting/cvp-analysis-break-even-target-profit-and-risk' },
  { source: '/marginal-costing/output', destination: '/study/management-accounting/marginal-costing' },
  { source: '/mastering-kagi-charts-a-step-by-step-guide-for-traders/output-10', destination: '/study/financial-market/mastering-kagi-charts-a-step-by-step-guide-for-traders' },
  { source: '/mastering-kagi-charts-a-step-by-step-guide-for-traders/output-11', destination: '/study/financial-market/mastering-kagi-charts-a-step-by-step-guide-for-traders' },
  { source: '/mastering-kagi-charts-a-step-by-step-guide-for-traders/output-12', destination: '/study/financial-market/mastering-kagi-charts-a-step-by-step-guide-for-traders' },
  { source: '/normal-distribution/normal-distribution-1', destination: '/study/management-accounting/normal-distribution' },
  { source: '/regression-analysis/screenshot-2023-12-29-055115-1', destination: '/study/management-accounting/regression-analysis' },
  { source: '/regression-analysis/screenshot-2023-12-29-055115', destination: '/study/management-accounting/regression-analysis' },
  { source: '/stepped-fixed-costs/image-11', destination: '/study/management-accounting/stepped-fixed-costs' },
  { source: '/t-accounts/image-1', destination: '/study/financial-accounting/t-accounts' },
  { source: '/t-accounts/image-2', destination: '/study/financial-accounting/t-accounts' },
  { source: '/t-accounts/image-3', destination: '/study/financial-accounting/t-accounts' },
  { source: '/t-accounts/image-4', destination: '/study/financial-accounting/t-accounts' },
  { source: '/t-accounts/image', destination: '/study/financial-accounting/t-accounts' },
  { source: '/work-in-progress-wip/output-3', destination: '/study/management-accounting/work-in-progress-wip' },
  { source: '/yield-curve/image-5', destination: '/study/financial-management/yield-curve' },
  { source: '/yield-curve/image-6', destination: '/study/financial-management/yield-curve' },
  { source: '/yield-curve/image-7', destination: '/study/financial-management/yield-curve' },
  { source: '/yield-curve/image-8', destination: '/study/financial-management/yield-curve' },
  { source: '/yield-curve/image-9', destination: '/study/financial-management/yield-curve' },
  // Category archives go to the matching study category (or page).
  { source: '/category/audit-and-assurance', destination: '/study/audit-assurance' },
  { source: '/category/auditing', destination: '/study/audit-assurance' },
  { source: '/category/business-management', destination: '/study/business-management' },
  { source: '/category/calculator', destination: '/calculators' },
  { source: '/category/cryptocurrency', destination: '/study/cryptocurrency' },
  { source: '/category/economics', destination: '/study/economics' },
  { source: '/category/financial-accounting', destination: '/study/financial-accounting' },
  { source: '/category/financial-management', destination: '/study/financial-management' },
  { source: '/category/financial-market', destination: '/study/financial-market' },
  { source: '/category/management-accounting', destination: '/study/management-accounting' },
  { source: '/category/mock-exam', destination: '/practice-questions' },
  { source: '/category/tax', destination: '/study/taxation' },
  { source: '/category/tools-and-templates', destination: '/study/tools-templates' },
  // The old author archive goes to the About page.
  { source: '/author/ab', destination: '/about' },
  // Tags with an exact article of the same name go to that article. Other tags stay 404.
  { source: '/tag/cash-records', destination: '/study/financial-accounting/cash-records' },
  { source: '/tag/double-entry-basics', destination: '/study/financial-accounting/double-entry-basics' },
  { source: '/tag/elements-of-financial-statements', destination: '/study/financial-accounting/elements-of-financial-statements' },
  { source: '/tag/general-ledger-posting-and-balances', destination: '/study/financial-accounting/general-ledger-posting-and-balances' },
  { source: '/tag/journals-and-day-books', destination: '/study/financial-accounting/journals-and-day-books' },
  { source: '/tag/payroll-in-the-accounts', destination: '/study/financial-accounting/payroll-in-the-accounts' },
  { source: '/tag/petty-cash-systems', destination: '/study/financial-accounting/petty-cash-systems' },
  { source: '/tag/preparing-the-trial-balance', destination: '/study/financial-accounting/preparing-the-trial-balance' },
  { source: '/tag/purchases-and-trade-payables', destination: '/study/financial-accounting/purchases-and-trade-payables' },
  { source: '/tag/reconciling-supplier-balances', destination: '/study/financial-accounting/reconciling-supplier-balances' },
  { source: '/tag/sales-and-trade-receivables', destination: '/study/financial-accounting/sales-and-trade-receivables' },
  { source: '/tag/source-documents', destination: '/study/financial-accounting/source-documents' },
  { source: '/tag/types-of-business-transactions', destination: '/study/financial-accounting/types-of-business-transactions' },
  { source: '/tag/working-capital-cycle', destination: '/study/financial-management/working-capital-cycle' },
])

// Old WordPress address classes without an exact row above (owner decision
// D303: redirect to the closest live page, never to the home page).
// next.config.mjs spreads these AFTER every exact rule, so an exact row always
// wins first. No address matches two patterns, so the result never depends on
// their order: the article-feed row skips the first segments the other rows
// own (comments, tag, category, author, feed).
// Tags go to the site search for the tag's words; an old article's feed goes
// to the old article address, which app/[slug] then sends to the article. A
// bare /<year> is not redirected (it could shadow a future single slug).
export const LEGACY_WORDPRESS_PATTERNS = Object.freeze([
  { source: '/tag/:tag/:rest*', destination: '/search?q=:tag' },
  { source: '/category/:category/:rest*', destination: '/study' },
  { source: '/author/:author/:rest*', destination: '/about' },
  { source: '/feed/:rest*', destination: '/articles' },
  { source: '/comments/feed/:rest*', destination: '/articles' },
  { source: '/page/:n(\\d+)/:rest*', destination: '/articles' },
  { source: '/:year(\\d{4})/:month(\\d{2})/:rest*', destination: '/articles' },
  { source: '/:slug((?!(?:comments|tag|category|author|feed)/)[^/#?]+)/feed/:rest*', destination: '/:slug' },
])
