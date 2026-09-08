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

export function useChangePassword() {
  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => toast.success("Password updated."),
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
