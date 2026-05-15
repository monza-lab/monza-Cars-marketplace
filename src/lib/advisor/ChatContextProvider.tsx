"use client"

import { createContext, useContext, useMemo, useState, useCallback } from "react"
import type { ChatContext } from "./types"

type ChatContextValue = {
  context: ChatContext
  setContext: (next: Partial<ChatContext>) => void
}

const DEFAULT_CONTEXT: ChatContext = {
  surface: "other",
  locale: "en",
  car: null,
  activeSection: null,
  seriesId: null,
}

const Ctx = createContext<ChatContextValue | null>(null)

export function ChatContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContextState] = useState<ChatContext>(DEFAULT_CONTEXT)
  const setContext = useCallback(
    (next: Partial<ChatContext>) => setContextState(prev => ({ ...prev, ...next })),
    []
  )
  const value = useMemo<ChatContextValue>(() => ({ context, setContext }), [context, setContext])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useChatContext(): ChatContextValue {
  const value = useContext(Ctx)
  if (!value) {
    throw new Error("useChatContext must be used inside <ChatContextProvider>")
  }
  return value
}
