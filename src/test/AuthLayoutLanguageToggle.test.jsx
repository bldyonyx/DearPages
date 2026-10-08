import { fireEvent, render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import AuthLayout from '../components/auth/AuthLayout.jsx'
import i18n, { LANGUAGE_STORAGE_KEY } from '../i18n/index.js'

function TranslatedAuthLayout() {
  const { t } = useTranslation()

  return (
    <MemoryRouter>
      <AuthLayout
        title={t('auth.login.title')}
        subtitle={t('auth.login.subtitle')}
        footerText={t('auth.login.footerText')}
        footerLinkText={t('auth.login.footerLink')}
        footerLinkTo="/signup"
      >
        <button type="button">{t('auth.login.submit')}</button>
      </AuthLayout>
    </MemoryRouter>
  )
}

describe('AuthLayout language toggle', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await i18n.changeLanguage('fr')
  })

  it('switches translated auth content immediately and persists the choice', () => {
    render(<TranslatedAuthLayout />)

    expect(screen.getByRole('heading')).toHaveTextContent(
      'Bon retour'
    )

    fireEvent.click(
      screen.getByRole('radio', { name: /passer en english/i })
    )

    expect(screen.getByRole('heading')).toHaveTextContent(
      'Welcome back'
    )
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe(
      'en'
    )

    fireEvent.click(
      screen.getByRole('radio', { name: /switch to français/i })
    )

    expect(screen.getByRole('heading')).toHaveTextContent(
      'Bon retour'
    )
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe(
      'fr'
    )
  })
})
