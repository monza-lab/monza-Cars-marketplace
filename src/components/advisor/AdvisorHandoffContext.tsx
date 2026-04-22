"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

interface HandoffValue {
  openChatConversationId: string | null
  startChatForConversation: (id: string) => void
  closeChat: () => void
}

const Ctx = createContext<HandoffValue | null>(null)

export function AdvisorHandoffProvider({ children }: { children: ReactNode }) {
  const [openChatConversationId, setOpenChatConversationId] = useState<string | null>(null)
  const startChatForConversation = useCallback((id: string) => setOpenChatConversationId(id), [])
  const closeChat = useCallback(() => setOpenChatConversationId(null), [])
  return (
    <Ctx.Provider value={{ openChatConversationId, startChatForConversation, closeChat }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAdvisorChatHandoff(): HandoffValue {
  const v = useContext(Ctx)
  if (!v) throw new Error("useAdvisorChatHandoff outside provider")
  return v
}

/**
 * Safe variant that returns null when used outside the provider. Oracle overlay
 * uses this because the provider is mounted in the root layout — but during
 * tests or partial renders the provider may be absent.
 */
export function useAdvisorChatHandoffOptional(): HandoffValue | null {
  return useContext(Ctx)
}
