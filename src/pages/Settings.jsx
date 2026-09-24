import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'

import AccountCard from '../components/settings/AccountCard.jsx'
import AccountDeleteModal from '../components/settings/AccountDeleteModal.jsx'
import ProfileCard from '../components/settings/ProfileCard.jsx'
import ReadingPreferencesCard from '../components/settings/ReadingPreferencesCard.jsx'
import { AVAILABLE_GENRES } from '../constants/genres.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  deleteCurrentUserAccount,
  logOut,
} from '../services/authService.js'
import { updateReadingPreferences } from '../services/preferencesService.js'

const DEFAULT_ANNUAL_GOAL = 24
const MAX_ANNUAL_GOAL = 200
const AVAILABLE_SUBJECTS = new Set(
  AVAILABLE_GENRES.map((genre) => genre.subject)
)

function getValidFavoriteGenres(favoriteGenres) {
  if (!Array.isArray(favoriteGenres)) return []

  const seenGenres = new Set()

  return favoriteGenres.filter((genre) => {
    if (
      typeof genre !== 'string' ||
      !AVAILABLE_SUBJECTS.has(genre) ||
      seenGenres.has(genre)
    ) {
      return false
    }

    seenGenres.add(genre)
    return true
  })
}

function getValidAnnualGoal(annualGoal) {
  return Number.isInteger(annualGoal) && annualGoal > 0
    ? annualGoal
    : DEFAULT_ANNUAL_GOAL
}

function normalizeAnnualGoal(value) {
  return Number(value)
}

function areGenresEqual(firstGenres, secondGenres) {
  if (firstGenres.length !== secondGenres.length) return false

  return firstGenres.every(
    (genre, index) => genre === secondGenres[index]
  )
}

function Settings() {
  const navigate = useNavigate()
  const {
    user,
    preferences,
    isPreferencesLoading,
    updatePreferences,
  } = useAuth()

  const [selectedGenres, setSelectedGenres] = useState([])
  const [annualGoal, setAnnualGoal] = useState(
    String(DEFAULT_ANNUAL_GOAL)
  )
  const [originalGenres, setOriginalGenres] = useState([])
  const [originalAnnualGoal, setOriginalAnnualGoal] = useState(
    DEFAULT_ANNUAL_GOAL
  )
  const [goalError, setGoalError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] =
    useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] =
    useState(false)

  useEffect(() => {
    if (isPreferencesLoading) return

    const nextGenres = getValidFavoriteGenres(
      preferences?.favoriteGenres
    )
    const nextAnnualGoal = getValidAnnualGoal(
      preferences?.annualGoal
    )

    // oxlint-disable-next-line react/set-state-in-effect
    setSelectedGenres(nextGenres)
    setAnnualGoal(String(nextAnnualGoal))
    setOriginalGenres(nextGenres)
    setOriginalAnnualGoal(nextAnnualGoal)
    setGoalError('')
    setSaveError('')
  }, [isPreferencesLoading, preferences])

  const normalizedAnnualGoal = useMemo(
    () => normalizeAnnualGoal(annualGoal),
    [annualGoal]
  )

  const hasGenreChanges = !areGenresEqual(
    selectedGenres,
    originalGenres
  )
  const hasAnnualGoalChanges =
    normalizedAnnualGoal !== originalAnnualGoal
  const hasChanges = hasGenreChanges || hasAnnualGoalChanges
  const isSaveDisabled =
    isPreferencesLoading || isSaving || !hasChanges || !user?.uid

  function toggleGenre(subject) {
    setSuccessMessage('')

    if (
      selectedGenres.includes(subject) &&
      selectedGenres.length === 1
    ) {
      setSaveError('Garde au moins un genre préféré.')
      return
    }

    setSaveError('')
    setSelectedGenres((currentGenres) => {
      if (!currentGenres.includes(subject)) {
        return [...currentGenres, subject]
      }

      return currentGenres.filter((genre) => genre !== subject)
    })
  }

  function handleAnnualGoalChange(value) {
    setGoalError('')
    setSaveError('')
    setSuccessMessage('')

    if (value === '') {
      setAnnualGoal('')
      return
    }

    setAnnualGoal(String(value))
  }

  function validatePreferences() {
    if (selectedGenres.length === 0) {
      setSaveError('Choisis au moins un genre préféré.')
      return false
    }

    if (
      !Number.isInteger(normalizedAnnualGoal) ||
      normalizedAnnualGoal < 1
    ) {
      setGoalError(
        'Indique un nombre entier supérieur ou égal à 1.'
      )
      return false
    }

    if (normalizedAnnualGoal > MAX_ANNUAL_GOAL) {
      setGoalError(
        `Choisis un objectif de ${MAX_ANNUAL_GOAL} livres maximum.`
      )
      return false
    }

    return true
  }

  async function handleSave() {
    if (isSaveDisabled || !validatePreferences()) return

    setIsSaving(true)
    setSaveError('')
    setSuccessMessage('')

    const changes = {}

    if (hasGenreChanges) {
      changes.favoriteGenres = selectedGenres
    }

    if (hasAnnualGoalChanges) {
      changes.annualGoal = normalizedAnnualGoal
    }

    try {
      const savedChanges = await updateReadingPreferences(
        user.uid,
        changes
      )
      const nextPreferences = {
        ...(preferences || {}),
        ...savedChanges,
      }

      updatePreferences(nextPreferences)
      setOriginalGenres(selectedGenres)
      setOriginalAnnualGoal(normalizedAnnualGoal)
      setSuccessMessage('Modifications enregistrées ♡')
    } catch (firebaseError) {
      console.error(firebaseError)
      setSaveError(
        "Impossible d'enregistrer tes préférences pour le moment."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLogout() {
    setLogoutError('')
    setIsLoggingOut(true)

    try {
      await logOut()
      navigate('/login')
    } catch (firebaseError) {
      console.error(firebaseError)
      setLogoutError(
        'Impossible de te déconnecter pour le moment.'
      )
      setIsLoggingOut(false)
    }
  }

  function getDeleteAccountErrorMessage(firebaseError) {
    if (firebaseError?.code === 'auth/requires-recent-login') {
      return 'Reconnecte-toi avant de supprimer ton compte, puis reviens dans Paramètres.'
    }

    if (
      firebaseError?.code === 'auth/wrong-password' ||
      firebaseError?.code === 'auth/invalid-credential'
    ) {
      return 'Mot de passe incorrect. Vérifie-le avant de supprimer ton compte.'
    }

    if (firebaseError?.code === 'auth/popup-closed-by-user') {
      return 'La confirmation Google a été fermée avant la suppression.'
    }

    if (firebaseError?.code === 'auth/user-mismatch') {
      return 'Le compte confirmé ne correspond pas au compte Dear Pages connecté.'
    }

    return 'Impossible de supprimer ton compte pour le moment.'
  }

  async function handleDeleteAccount({ password } = {}) {
    if (!user || isDeletingAccount) return

    setDeleteError('')
    setIsDeletingAccount(true)

    try {
      await deleteCurrentUserAccount(user, { password })
      updatePreferences(null)
      navigate('/login', { replace: true })
    } catch (firebaseError) {
      console.error(firebaseError)
      setDeleteError(getDeleteAccountErrorMessage(firebaseError))
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="p-6">
      <header className="py-4">
        <p className="font-handwritten text-xl text-walnut sm:text-2xl">
          ton petit coin tranquille
        </p>

        <h1 className="mt-2 font-heading text-3xl font-bold text-darkwood md:text-4xl">
          Paramètres
        </h1>

        <p className="mt-2 max-w-2xl font-ui text-sm font-semibold leading-relaxed text-darkwood/60 md:text-base">
          Ajuste ce qui guide Dear Pages, sans perdre le fil de tes
          lectures.
        </p>
      </header>

      {user && (
        <div className="mt-6 grid gap-6">
          <ProfileCard user={user} />

          <ReadingPreferencesCard
            annualGoal={annualGoal}
            saveError={saveError}
            goalError={goalError}
            hasChanges={hasChanges}
            isLoading={isPreferencesLoading}
            isSaveDisabled={isSaveDisabled}
            isSaving={isSaving}
            selectedGenres={selectedGenres}
            successMessage={successMessage}
            onAnnualGoalChange={handleAnnualGoalChange}
            onSave={handleSave}
            onToggleGenre={toggleGenre}
          />

          <AccountCard
            deleteError={deleteError}
            error={logoutError}
            isDeletingAccount={isDeletingAccount}
            isLoggingOut={isLoggingOut}
            onDeleteRequest={() => {
              setDeleteError('')
              setIsDeleteModalOpen(true)
            }}
            onLogout={handleLogout}
          />
        </div>
      )}

      <AccountDeleteModal
        error={deleteError}
        isDeleting={isDeletingAccount}
        isOpen={isDeleteModalOpen}
        user={user}
        onClose={() => {
          setDeleteError('')
          setIsDeleteModalOpen(false)
        }}
        onDelete={handleDeleteAccount}
      />
    </div>
  )
}

export default Settings
