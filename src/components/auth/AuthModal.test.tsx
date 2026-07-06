// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AuthModal } from "./AuthModal"

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmationEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithMagicLink: vi.fn(),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const copy: Record<string, string> = {
      createAccountTitle: "Create Account",
      welcomeBack: "Welcome back",
      createAccountDesc: "Get 3 free reports every month",
      signInDesc: "Sign in to access your reports",
      continueWithGoogle: "Continue with Google",
      or: "or",
      name: "Name",
      namePlaceholder: "Your name",
      email: "Email",
      emailPlaceholder: "you@example.com",
      password: "Password",
      passwordPlaceholder: "Password",
      signIn: "Sign In",
      switchToSignIn: "Already have an account?",
      switchToSignUp: "Need an account?",
      signupLegalNotice: "By creating an account, you agree to our",
      signupLegalTerms: "Terms",
      signupLegalAnd: "and",
      signupLegalPrivacy: "Privacy Policy",
      magicLinkDesc: "We will email you a one-tap sign-in link.",
      magicLinkSentTitle: "Check your inbox",
      magicLinkSentBody: "We sent a link to",
      magicLinkSentHint: "Open it to continue.",
      magicLinkResend: "Resend email",
      magicLinkResendCooldown: "Wait",
      magicLinkTryAnother: "Try another email",
      unexpectedError: "Unexpected error",
      emailRequired: "Email is required",
    }
    return copy[key] ?? key
  },
}))

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => authMocks,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe("AuthModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("opens signup in password mode before offering the email-link fallback", () => {
    render(<AuthModal open onOpenChange={vi.fn()} defaultMode="signup" />)

    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /use email link instead/i })).toBeInTheDocument()
    expect(screen.queryByText("We will email you a one-tap sign-in link.")).not.toBeInTheDocument()
  })

  it("closes after password signup when Supabase creates an immediate session", async () => {
    authMocks.signUp.mockResolvedValue({ error: null, needsEmailConfirmation: false })
    const onOpenChange = vi.fn()

    render(<AuthModal open onOpenChange={onOpenChange} defaultMode="signup" />)
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Buyer" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }))

    await waitFor(() => expect(authMocks.signUp).toHaveBeenCalledWith(
      "buyer@example.com",
      "secret123",
      "Buyer",
    ))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.queryByText("Check your inbox")).not.toBeInTheDocument()
  })
})
