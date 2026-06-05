// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AuthRequiredPrompt } from "./AuthRequiredPrompt"

const refresh = vi.fn()
let mockUser: unknown = null

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock("./AuthModal", () => ({
  AuthModal: () => null,
}))

describe("AuthRequiredPrompt", () => {
  it("refreshes the current server route after login so the user stays on the requested report", async () => {
    mockUser = { id: "auth-user-1" }

    render(<AuthRequiredPrompt message="Sign in to continue" />)

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  })
})
