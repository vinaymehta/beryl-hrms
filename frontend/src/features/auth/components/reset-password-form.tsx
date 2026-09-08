"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { resetPasswordSchema, type ResetPasswordValues } from "@/features/auth/schemas"
import { useResetPassword } from "@/features/auth/hooks/use-auth-mutations"

export function ResetPasswordForm({ token }: { token: string }) {
  const resetPassword = useResetPassword()
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", passwordConfirmation: "" },
  })

  function onSubmit(values: ResetPasswordValues) {
    resetPassword.mutate({
      token,
      password: values.password,
      passwordConfirmation: values.passwordConfirmation,
    })
  }

  return (
    <Card>
      <CardHeader>
        <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent-foreground text-primary-foreground shadow-sm shadow-primary/30">
          <KeyRoundIcon className="size-5" />
        </span>
        <CardTitle className="text-xl">Set a new password</CardTitle>
        <CardDescription>Choose a strong password you haven&apos;t used before.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passwordConfirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* See login-form.tsx: Base UI's Button forces type="button" internally,
                so the click needs an explicit handler alongside the form's onSubmit. */}
            <Button
              type="submit"
              className="w-full"
              disabled={resetPassword.isPending}
              onClick={form.handleSubmit(onSubmit)}
            >
              {resetPassword.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
