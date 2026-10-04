import { describe, expect, it } from 'vitest'
import { getEmailSignInErrorMessage } from '../services/authService'

describe('getEmailSignInErrorMessage', () => {
  it('returns the correct message for an unknown user', () => {
    expect(
      getEmailSignInErrorMessage({
        code: 'auth/user-not-found',
      })
    ).toBe(
      'Aucun compte n’existe avec cette adresse e-mail.'
    )
  })

  it('returns the correct message for a wrong password', () => {
    expect(
      getEmailSignInErrorMessage({
        code: 'auth/wrong-password',
      })
    ).toBe('Mot de passe incorrect.')
  })

  it('returns the correct message for an invalid email', () => {
    expect(
      getEmailSignInErrorMessage({
        code: 'auth/invalid-email',
      })
    ).toBe('Adresse e-mail invalide.')
  })

  it('returns the correct message for a disabled account', () => {
    expect(
      getEmailSignInErrorMessage({
        code: 'auth/user-disabled',
      })
    ).toBe('Ce compte a été désactivé.')
  })

  it('returns the correct message after too many attempts', () => {
    expect(
      getEmailSignInErrorMessage({
        code: 'auth/too-many-requests',
      })
    ).toBe(
      'Trop de tentatives. Réessaie dans quelques minutes.'
    )
  })

  it('returns the correct message for a network error', () => {
    expect(
      getEmailSignInErrorMessage({
        code: 'auth/network-request-failed',
      })
    ).toBe(
      'Connexion impossible. Vérifie ta connexion internet.'
    )
  })

  it('returns a generic credentials message for invalid credentials', () => {
    expect(
      getEmailSignInErrorMessage({
        code: 'auth/invalid-credential',
      })
    ).toBe('E-mail ou mot de passe incorrect.')
  })

  it('returns the fallback message for an unknown error', () => {
    expect(
      getEmailSignInErrorMessage({
        code: 'auth/something-else',
      })
    ).toBe('Impossible de se connecter pour le moment.')
  })

  it('returns the fallback message when no error is provided', () => {
    expect(getEmailSignInErrorMessage()).toBe(
      'Impossible de se connecter pour le moment.'
    )
  })
})