import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
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

function getDeleteAccountErrorMessage(firebaseError, t) {
  if (firebaseError?.code === 'auth/requires-recent-login') {
    return t('settings.account.deleteErrors.recentLogin')
  }

  if (
    firebaseError?.code === 'auth/wrong-password' ||
    firebaseError?.code === 'auth/invalid-credential'
  ) {
    return t('settings.account.deleteErrors.wrongPassword')
  }

  if (firebaseError?.code === 'auth/popup-closed-by-user') {
    return t('settings.account.deleteErrors.popupClosed')
  }

  if (firebaseError?.code === 'auth/user-mismatch') {
    return t('settings.account.deleteErrors.userMismatch')
  }

  return t('settings.account.deleteErrors.fallback')
}

function useSettings() {
  const { t } = useTranslation()
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
      setSaveError(t('settings.preferences.keepOneGenre'))
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
      setSaveError(t('settings.preferences.chooseOneGenre'))
      return false
    }

    if (
      !Number.isInteger(normalizedAnnualGoal) ||
      normalizedAnnualGoal < 1
    ) {
      setGoalError(
        t('settings.preferences.invalidGoal')
      )
      return false
    }

    if (normalizedAnnualGoal > MAX_ANNUAL_GOAL) {
      setGoalError(
        t('settings.preferences.maxGoal', {
          count: MAX_ANNUAL_GOAL,
        })
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
      setSuccessMessage(t('settings.preferences.success'))
    } catch (firebaseError) {
      console.error(firebaseError)
      setSaveError(
        t('settings.preferences.saveError')
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
      setProfileError(t('settings.profile.nameRequired'))
      return
    }

    if (trimmedDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
      setProfileError(
        t('settings.profile.nameTooLong', {
          count: MAX_DISPLAY_NAME_LENGTH,
        })
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
      setProfileSuccessMessage(t('settings.profile.success'))
    } catch (firebaseError) {
      console.error(firebaseError)
      setProfileError(
        t('settings.profile.saveError')
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
        t('settings.account.logoutError')
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
        getDeleteAccountErrorMessage(firebaseError, t)
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
