// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AuthRequiredPrompt } from "./AuthRequiredPrompt"

const refresh = vi.fn()
const AuthModalMock = vi.fn((_props: Record<string, unknown>) => null)
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
  AuthModal: (props: Record<string, unknown>) => AuthModalMock(props),
}))

describe("AuthRequiredPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = null
  })

  it("refreshes the current server route after login so the user stays on the requested report", async () => {
    mockUser = { id: "auth-user-1" }

    render(<AuthRequiredPrompt message="Sign in to continue" />)

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  })

  it("opens the real auth modal in signup mode for cold report gates", () => {
    render(<AuthRequiredPrompt message="Create an account to continue" />)

    fireEvent.click(screen.getByRole("button", { name: "createAccountTitle" }))

    expect(AuthModalMock).toHaveBeenLastCalledWith(expect.objectContaining({
      open: true,
      defaultMode: "signup",
    }))
  })
})
