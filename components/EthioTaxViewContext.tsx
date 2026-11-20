'use client'

// The request's view (EthioTax or Accounting Body) for a client page that has
// no server parent of its own to pass it as a prop: its server layout reads
// the view and provides it here, so the server render and the first client
// render are the same.
import { createContext, useContext, type ReactNode } from 'react'

const EthioTaxViewContext = createContext(false)

export function EthioTaxViewProvider({ isEthioTax, children }: { isEthioTax: boolean; children: ReactNode }) {
  return <EthioTaxViewContext.Provider value={isEthioTax}>{children}</EthioTaxViewContext.Provider>
}

export function useIsEthioTaxView(): boolean {
  return useContext(EthioTaxViewContext)
}
