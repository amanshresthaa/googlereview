"use client"

import * as React from "react"

type SearchState = {
  query: string
  setQuery: (q: string) => void
}

const SearchContext = React.createContext<SearchState | null>(null)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = React.useState("")

  const value = React.useMemo(() => ({ query, setQuery }), [query])
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useGlobalSearch(): SearchState {
  const ctx = React.useContext(SearchContext)
  if (!ctx) {
    throw new Error("useGlobalSearch must be used within <SearchProvider>.")
  }
  return ctx
}

