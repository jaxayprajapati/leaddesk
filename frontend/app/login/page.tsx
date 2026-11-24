import type { Metadata } from "next"
import Link from "next/link"

import { AuthLayout } from "@/components/auth-layout"
import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <AuthLayout title="Sign in" description="Use the login your agency gave you.">
      <LoginForm next={next ?? "/"} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to LeadDesk?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an agency account
        </Link>
      </p>
    </AuthLayout>
  )
}
