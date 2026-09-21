import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from 'lucide-react'

import AuthLayout from '../components/auth/AuthLayout.jsx'
import GoogleIcon from '../components/auth/GoogleIcon.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  signInWithEmail,
  signInWithGoogle,
} from '../services/authService.js'

function Login() {
  const navigate = useNavigate()
  const { updatePreferences } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setIsLoading(true)

    try {
      await signInWithEmail(email.trim(), password)
      navigate('/')
    } catch (firebaseError) {
      console.error(firebaseError)
      setError('E-mail ou mot de passe incorrect.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setError('')
    setIsLoading(true)

    try {
      const result = await signInWithGoogle()

      if (result.preferences) {
        updatePreferences(result.preferences)
      }

      navigate('/')
    } catch (firebaseError) {
      console.error(firebaseError)
      setError(
        'Impossible de continuer avec Google pour le moment.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Bon retour ♡"
      subtitle="Ça fait plaisir de te revoir."
      footerText="Tu n'as pas encore de compte ?"
      footerLinkText="Créer un compte"
      footerLinkTo="/signup"
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <label className="relative block">
          <Mail
            size={20}
            strokeWidth={1.7}
            className="
              pointer-events-none absolute left-4
              top-1/2 -translate-y-1/2 text-walnut
            "
          />

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Adresse e-mail"
            autoComplete="email"
            required
            className="
              w-full rounded-2xl border
              border-walnut/20 bg-white/35
              py-4 pl-12 pr-4
              text-sm text-ink outline-none
              transition
              placeholder:text-walnut/45
              focus:border-olive/60
              focus:ring-2 focus:ring-lime/40
            "
          />
        </label>

        <label className="relative block">
          <LockKeyhole
            size={20}
            strokeWidth={1.7}
            className="
              pointer-events-none absolute left-4
              top-1/2 -translate-y-1/2 text-walnut
            "
          />

          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            autoComplete="current-password"
            required
            className="
              w-full rounded-2xl border
              border-walnut/20 bg-white/35
              py-4 pl-12 pr-12
              text-sm text-ink outline-none
              transition
              placeholder:text-walnut/45
              focus:border-olive/60
              focus:ring-2 focus:ring-lime/40
            "
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword((current) => !current)
            }
            aria-label={
              showPassword
                ? 'Masquer le mot de passe'
                : 'Afficher le mot de passe'
            }
            className="
              absolute right-4 top-1/2
              -translate-y-1/2 text-walnut
              transition-opacity hover:opacity-60
            "
          >
            {showPassword ? (
              <EyeOff size={20} strokeWidth={1.7} />
            ) : (
              <Eye size={20} strokeWidth={1.7} />
            )}
          </button>
        </label>

        {error && (
          <p className="text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="
            mt-2 w-full rounded-2xl
            bg-lime px-5 py-4
            font-bold text-darkwood
            transition
            hover:-translate-y-0.5 hover:brightness-95
            disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          {isLoading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-walnut/20" />

        <span className="font-heading text-lg text-walnut">
          ou
        </span>

        <div className="h-px flex-1 bg-walnut/20" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="
          flex w-full items-center justify-center gap-3
          rounded-2xl border border-walnut/20
          bg-white/35 px-5 py-4
          font-bold text-darkwood
          transition
          hover:bg-white/60
          disabled:cursor-not-allowed disabled:opacity-60
        "
      >
        <GoogleIcon />
        Continuer avec Google
      </button>
    </AuthLayout>
  )
}

export default Login
