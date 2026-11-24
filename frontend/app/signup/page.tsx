import type { Metadata } from "next"
import Link from "next/link"

import { AuthLayout } from "@/components/auth-layout"
import { SignupForm } from "@/components/signup-form"

export const metadata: Metadata = { title: "Create your agency account" }

export default function SignupPage() {
  return (
    <AuthLayout wide title="Create your agency account" description="You'll be the owner. Add your agents once you're in.">
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have a login?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
