import { render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const authMocks = vi.hoisted(() => ({
  auth: { currentUser: null },
  callback: null,
  unsubscribe: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    authMocks.callback = callback
    return authMocks.unsubscribe
  }),
}))

const preferencesMocks = vi.hoisted(() => ({
  getUserPreferences: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: authMocks.onAuthStateChanged,
}))

vi.mock('../services/firebase.js', () => ({
  auth: authMocks.auth,
}))

vi.mock('../services/preferencesService.js', () => ({
  getUserPreferences: preferencesMocks.getUserPreferences,
}))

import {
  AuthProvider,
  useAuth,
} from '../context/AuthContext.jsx'

function AuthStateProbe() {
  const {
    preferences,
    isPreferencesLoading,
    isPreferencesResolved,
    onboardingStatus,
    requiresOnboarding,
    hasCompletedOnboarding,
  } = useAuth()

  return (
    <output aria-label="auth-state">
      {JSON.stringify({
        preferences,
        isPreferencesLoading,
        isPreferencesResolved,
        onboardingStatus,
        requiresOnboarding,
        hasCompletedOnboarding,
      })}
    </output>
  )
}

function renderAuthProvider() {
  render(
    <AuthProvider>
      <AuthStateProbe />
    </AuthProvider>
  )
}

function readAuthState() {
  return JSON.parse(
    screen.getByLabelText('auth-state').textContent
  )
}

describe('AuthContext preferences loading', () => {
  beforeEach(() => {
    authMocks.auth.currentUser = null
    authMocks.callback = null
    authMocks.unsubscribe.mockClear()
    authMocks.onAuthStateChanged.mockClear()
    preferencesMocks.getUserPreferences.mockReset()
  })

  it('preserves required onboarding when preferences load normally', async () => {
    preferencesMocks.getUserPreferences.mockResolvedValue({
      onboardingCompleted: false,
      language: 'fr',
    })

    renderAuthProvider()

    await waitFor(() => {
      expect(authMocks.callback).toBeTypeOf('function')
    })

    act(() => {
      authMocks.callback({ uid: 'user-1' })
    })

    await waitFor(() => {
      expect(readAuthState()).toMatchObject({
        preferences: {
          onboardingCompleted: false,
          language: 'fr',
        },
        isPreferencesLoading: false,
        isPreferencesResolved: true,
        onboardingStatus: 'required',
        requiresOnboarding: true,
        hasCompletedOnboarding: false,
      })
    })
  })

  it('resolves preferences loading when Firebase preferences fail', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    preferencesMocks.getUserPreferences.mockRejectedValue(
      new Error('Firebase unavailable')
    )

    renderAuthProvider()

    await waitFor(() => {
      expect(authMocks.callback).toBeTypeOf('function')
    })

    act(() => {
      authMocks.callback({ uid: 'user-1' })
    })

    await waitFor(() => {
      expect(readAuthState()).toMatchObject({
        preferences: null,
        isPreferencesLoading: false,
        isPreferencesResolved: true,
        onboardingStatus: 'unknown',
        requiresOnboarding: false,
        hasCompletedOnboarding: false,
      })
    })

    consoleError.mockRestore()
  })
})
