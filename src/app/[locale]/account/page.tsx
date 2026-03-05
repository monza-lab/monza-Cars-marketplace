"use client"

import { useAuth } from "@/lib/auth/AuthProvider"
import { AuthRequiredPrompt } from "@/components/auth/AuthRequiredPrompt"
import { BillingDashboard } from "@/components/payments/BillingDashboard"
import { MonzaInfinityLoader } from "@/components/shared/MonzaInfinityLoader"
import { User } from "lucide-react"

export default function AccountPage() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <MonzaInfinityLoader />
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center px-4">
        <AuthRequiredPrompt message="Sign in to view your account and billing" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 border border-primary/20">
            <User className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Account</h1>
            <p className="text-[12px] text-muted-foreground">
              {profile?.email || user.email}
            </p>
          </div>
        </div>

        {/* Billing Dashboard */}
        <BillingDashboard />
      </div>
    </div>
  )
}
