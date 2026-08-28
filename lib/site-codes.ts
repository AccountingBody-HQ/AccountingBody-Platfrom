// UI sends full site names; Supabase's show_on_sites/platform columns use short codes (only 'ab' has prior precedent)
export const SITE_CODE_MAP: Record<string, string> = {
  accountingbody: 'ab',
  hrlake:         'hr',
  ethiotax:       'et',
}
