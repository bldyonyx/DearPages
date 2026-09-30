import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'

import { AVAILABLE_GENRES } from '../constants/genres.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  deleteCurrentUserAccount,
  logOut,
  updateUserDisplayName,
} from '../services/authService.js'
import { updateReadingPreferences } from '../services/preferencesService.js'

const DEFAULT_ANNUAL_GOAL = 24
const MAX_ANNUAL_GOAL = 200
const MAX_DISPLAY_NAME_LENGTH = 50

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

function useSettings() {
  const navigate = useNavigate()

  const {
    user,
    preferences,
    isPreferencesLoading,
    updatePreferences,
    refreshUser,
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

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileSuccessMessage, setProfileSuccessMessage] =
    useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

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

  useEffect(() => {
    if (!user) return

    // oxlint-disable-next-line react/set-state-in-effect
    setDisplayName(user.displayName?.trim() || '')
  }, [user])

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

  const hasChanges =
    hasGenreChanges || hasAnnualGoalChanges

  const isSaveDisabled =
    isPreferencesLoading ||
    isSaving ||
    !hasChanges ||
    !user?.uid

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

  function startProfileEditing() {
    setDisplayName(user?.displayName?.trim() || '')
    setProfileError('')
    setProfileSuccessMessage('')
    setIsEditingProfile(true)
  }

  function cancelProfileEditing() {
    setDisplayName(user?.displayName?.trim() || '')
    setProfileError('')
    setIsEditingProfile(false)
  }

  function handleDisplayNameChange(value) {
    setDisplayName(value)
    setProfileError('')
    setProfileSuccessMessage('')
  }

  async function handleProfileSave() {
    if (!user || isSavingProfile) return

    const trimmedDisplayName = displayName.trim()

    if (!trimmedDisplayName) {
      setProfileError('Choisis un nom à afficher.')
      return
    }

    if (trimmedDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
      setProfileError(
        `Ton nom peut contenir ${MAX_DISPLAY_NAME_LENGTH} caractères maximum.`
      )
      return
    }

    if (trimmedDisplayName === user.displayName?.trim()) {
      setIsEditingProfile(false)
      return
    }

    setIsSavingProfile(true)
    setProfileError('')
    setProfileSuccessMessage('')

    try {
      const savedDisplayName = await updateUserDisplayName(
        user,
        trimmedDisplayName
      )

      setDisplayName(savedDisplayName)
      refreshUser()
      setIsEditingProfile(false)
      setProfileSuccessMessage('Profil mis à jour ♡')
    } catch (firebaseError) {
      console.error(firebaseError)
      setProfileError(
        "Impossible de modifier ton nom pour le moment."
      )
    } finally {
      setIsSavingProfile(false)
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
      setDeleteError(
        getDeleteAccountErrorMessage(firebaseError)
      )
      setIsDeletingAccount(false)
    }
  }

  function openDeleteModal() {
    setDeleteError('')
    setIsDeleteModalOpen(true)
  }

  function closeDeleteModal() {
    setDeleteError('')
    setIsDeleteModalOpen(false)
  }

  return {
    user,

    annualGoal,
    selectedGenres,
    displayName,

    goalError,
    saveError,
    successMessage,
    profileError,
    profileSuccessMessage,
    logoutError,
    deleteError,

    hasChanges,
    isPreferencesLoading,
    isSaveDisabled,
    isSaving,
    isEditingProfile,
    isSavingProfile,
    isLoggingOut,
    isDeleteModalOpen,
    isDeletingAccount,

    toggleGenre,
    handleAnnualGoalChange,
    handleSave,
    startProfileEditing,
    cancelProfileEditing,
    handleDisplayNameChange,
    handleProfileSave,
    handleLogout,
    handleDeleteAccount,
    openDeleteModal,
    closeDeleteModal,
  }
}

export default useSettings