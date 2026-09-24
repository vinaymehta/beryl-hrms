"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { authApi } from "@/features/auth/api"
import { CURRENT_USER_QUERY_KEY } from "@/features/auth/hooks/use-current-user"
import { ApiError } from "@/types/api"
import type { AuthUser } from "@/types/auth"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useLogin() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
      router.push("/")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't sign in. Please try again.")),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
      router.push("/verify-email")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create your account. Please try again.")),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null)
      queryClient.clear()
      router.push("/login")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't sign out. Please try again.")),
  })
}

export function useVerifyEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: authApi.forgotPassword,
    onError: (error) => toast.error(errorMessage(error, "Something went wrong. Please try again.")),
  })
}

export function useResetPassword() {
  const router = useRouter()

  return useMutation({
    mutationFn: ({
      token,
      password,
      passwordConfirmation,
    }: {
      token: string
      password: string
      passwordConfirmation: string
    }) => authApi.resetPassword(token, password, passwordConfirmation),
    onSuccess: () => {
      toast.success("Password reset. Please sign in with your new password.")
      router.push("/login")
    },
    onError: (error) => toast.error(errorMessage(error, "That reset link is invalid or has expired.")),
  })
}

/**
 * Setting a password from an invitation link.
 *
 * Straight to the dashboard on success rather than back to /login: the
 * employee has just chosen this password and the server signed them in, so
 * asking them to type it again immediately would be pure ceremony. This is
 * also what satisfies the initial forced-password-change requirement — the
 * first password IS the change, so nothing further is demanded of them.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: ({
      token,
      password,
      passwordConfirmation,
    }: {
      token: string
      password?: string
      passwordConfirmation?: string
    }) => authApi.acceptInvitation(token, password, passwordConfirmation),
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
      toast.success("Welcome. Your account is ready.")
      // Their own record when they have one — an employee has no reason to
      // land on a dashboard built for whoever manages them.
      router.push(user.employeeId ? "/profile" : "/")
    },
    onError: (error) =>
      toast.error(errorMessage(error, "That invitation link is invalid, expired, or already used.")),
  })
}

export function useChangePassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      // Refetch identity, not just for tidiness: when the change was one the
      // admin REQUIRED, this is what lifts the block — mustChangePassword is
      // read from the current user, so a stale copy would leave the person
      // staring at the same screen after doing exactly what was asked.
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
      toast.success("Password updated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update your password.")),
  })
}

export function useRevokeSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] })
      toast.success("Session revoked.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't revoke that session.")),
  })
}
