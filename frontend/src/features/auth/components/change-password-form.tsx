"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { changePasswordSchema, type ChangePasswordValues } from "@/features/auth/schemas"
import { useChangePassword } from "@/features/auth/hooks/use-auth-mutations"

export function ChangePasswordForm() {
  const changePassword = useChangePassword()
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", passwordConfirmation: "" },
  })

  function onSubmit(values: ChangePasswordValues) {
    changePassword.mutate(values, { onSuccess: () => form.reset() })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-sm gap-4" noValidate>
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
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
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* See login-form.tsx: Base UI's Button forces type="button" internally,
            so the click needs an explicit handler alongside the form's onSubmit. */}
        <Button
          type="submit"
          disabled={changePassword.isPending}
          className="w-fit"
          onClick={form.handleSubmit(onSubmit)}
        >
          {changePassword.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Form>
  )
}
