'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";

import { buildAuthMessage } from '@/lib/stellar/authMessage'

type UserSession = {
  id: string
  accountAddress: string
}

type UserContextValue = {
  walletAddress: string | null
  session: UserSession | null
  /** True after the first /api/auth/session check on load (avoids OAuth consent flash). */
  sessionHydrated: boolean
  isLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [session, setSession] = useState<UserSession | null>(null)
  const [sessionHydrated, setSessionHydrated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.authenticated && data?.user) {
        const u = data.user as UserSession
        setSession(u)
        setWalletAddress(u.accountAddress)
      } else {
        setSession(null)
        setWalletAddress(null)
      }
    } catch {
      setSession(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        // Initialize kit once per browser session.
        // We keep it global/static within the library.
        StellarWalletsKit.init({
          modules: defaultModules(),
          // Frontend is testnet-first for now (memo-based payment proofs).
          network: Networks.TESTNET
        })

        const net = await StellarWalletsKit.getNetwork()
        // Default to the kit's configured network. Backend auth verification only
        // depends on the Ed25519 signature over the canonical message.
        if (!cancelled && net?.networkPassphrase) {
          // no-op; ensures kit is ready
        }
      } catch {
        // If init fails, we'll still render a connect button.
      }

      if (!cancelled) await refreshSession()
      if (!cancelled) setSessionHydrated(true)
    })()

    return () => {
      cancelled = true
    }
  }, [refreshSession])

  const signIn = useCallback(async () => {
    setIsLoading(true)
    try {
      const { address } = await StellarWalletsKit.authModal()
      setWalletAddress(address)

      const nonceRes = await fetch('/api/auth/nonce', { method: 'GET' })
      if (!nonceRes.ok) {
        throw new Error(`GET /api/auth/nonce failed: ${nonceRes.status}`)
      }

      const nonceBody = (await nonceRes.json()) as { nonce: string; domain: string }

      // Create the canonical message wallet must sign (same format as backend).
      const message = buildAuthMessage({
        nonce: nonceBody.nonce,
        accountAddress: address,
        domain: nonceBody.domain
      })

      const net = await StellarWalletsKit.getNetwork()
      const signatureRes = await StellarWalletsKit.signMessage(message, {
        networkPassphrase: net.networkPassphrase,
        address
      })

      const signature = signatureRes.signedMessage
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress: address,
          nonce: nonceBody.nonce,
          signature
        })
      })

      const sessionJson = safeJsonParse<any>(await sessionRes.text())
      if (!sessionRes.ok || !sessionJson?.success) {
        throw new Error(sessionJson?.error ?? 'Failed to create session')
      }

      await refreshSession()
    } finally {
      setIsLoading(false)
    }
  }, [refreshSession])

  const signOut = useCallback(async () => {
    setIsLoading(true)
    try {
      // We only clear frontend state; cookie destruction is handled by backend route.
      await fetch('/api/auth/session', {
        method: 'DELETE',
        credentials: 'include'
      }).catch(() => undefined)
      setSession(null)
      setWalletAddress(null)
      if (StellarWalletsKit.disconnect) {
        await StellarWalletsKit.disconnect().catch(() => undefined)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const value = useMemo<UserContextValue>(
    () => ({
      walletAddress,
      session,
      sessionHydrated,
      isLoading,
      signIn,
      signOut,
      refreshSession
    }),
    [walletAddress, session, sessionHydrated, isLoading, signIn, signOut, refreshSession]
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within a UserProvider')
  return ctx
}

