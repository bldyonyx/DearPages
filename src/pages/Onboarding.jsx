import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import CompleteStep from '../components/onboarding/CompleteStep.jsx'
import GenresStep from '../components/onboarding/GenresStep.jsx'
import OnboardingShell from '../components/onboarding/OnboardingShell.jsx'
import ReadingGoalStep from '../components/onboarding/ReadingGoalStep.jsx'
import WelcomeStep from '../components/onboarding/WelcomeStep.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { saveOnboardingPreferences } from '../services/preferencesService.js'

const TOTAL_STEPS = 4
const DEFAULT_ANNUAL_GOAL = 24
const MAX_ANNUAL_GOAL = 200

function normalizeAnnualGoal(value) {
  return Number(value)
}

function Onboarding() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const { user, updatePreferences } = useAuth()

  const [currentStep, setCurrentStep] = useState(0)
  const [favoriteGenres, setFavoriteGenres] = useState([])
  const [annualGoal, setAnnualGoal] = useState(DEFAULT_ANNUAL_GOAL)
  const [genreValidationMessage, setGenreValidationMessage] =
    useState('')
  const [goalValidationMessage, setGoalValidationMessage] =
    useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function goToNextStep() {
    setCurrentStep((step) =>
      Math.min(step + 1, TOTAL_STEPS - 1)
    )
  }

  function goToPreviousStep() {
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  function toggleGenre(subject) {
    setGenreValidationMessage('')
    setFavoriteGenres((currentGenres) =>
      currentGenres.includes(subject)
        ? currentGenres.filter((genre) => genre !== subject)
        : [...currentGenres, subject]
    )
  }

  function handleGenresNext() {
    if (favoriteGenres.length === 0) {
      setGenreValidationMessage(
        t('onboarding.genres.validation')
      )
      return
    }

    setGenreValidationMessage('')
    goToNextStep()
  }

  function handleAnnualGoalChange(value) {
    setGoalValidationMessage('')

    if (value === '') {
      setAnnualGoal(0)
      return
    }

    setAnnualGoal(Number(value))
  }

  function handleGoalNext() {
    const normalizedGoal = normalizeAnnualGoal(annualGoal)

    if (
      !Number.isInteger(normalizedGoal) ||
      normalizedGoal < 1
    ) {
      setGoalValidationMessage(
        t('onboarding.goal.invalid')
      )
      return
    }

    if (normalizedGoal > MAX_ANNUAL_GOAL) {
      setGoalValidationMessage(
        t('onboarding.goal.max', {
          count: MAX_ANNUAL_GOAL,
        })
      )
      return
    }

    setAnnualGoal(normalizedGoal)
    setGoalValidationMessage('')
    goToNextStep()
  }

  async function finishOnboarding() {
    if (isSaving) return

    setSaveError('')

    if (!user?.uid) {
      setSaveError(
        t('onboarding.sessionError')
      )
      return
    }

    setIsSaving(true)

    try {
      const savedPreferences = await saveOnboardingPreferences(
        user.uid,
        favoriteGenres,
        normalizedAnnualGoal,
        i18n.language
      )
      updatePreferences(savedPreferences)
      navigate('/')
    } catch (firebaseError) {
      console.error(firebaseError)
      setSaveError(
        t('onboarding.saveError')
      )
    } finally {
      setIsSaving(false)
    }
  }

  const normalizedAnnualGoal =
    normalizeAnnualGoal(annualGoal) || DEFAULT_ANNUAL_GOAL

  return (
    <OnboardingShell
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
    >
      {currentStep === 0 && (
        <WelcomeStep
          displayName={user?.displayName}
          onNext={goToNextStep}
        />
      )}

      {currentStep === 1 && (
        <GenresStep
          selectedGenres={favoriteGenres}
          validationMessage={genreValidationMessage}
          onBack={goToPreviousStep}
          onNext={handleGenresNext}
          onToggleGenre={toggleGenre}
        />
      )}

      {currentStep === 2 && (
        <ReadingGoalStep
          annualGoal={annualGoal}
          validationMessage={goalValidationMessage}
          onBack={goToPreviousStep}
          onGoalChange={handleAnnualGoalChange}
          onNext={handleGoalNext}
        />
      )}

      {currentStep === 3 && (
        <CompleteStep
          annualGoal={normalizedAnnualGoal}
          favoriteGenres={favoriteGenres}
          isSaving={isSaving}
          saveError={saveError}
          onBack={goToPreviousStep}
          onFinish={finishOnboarding}
        />
      )}
    </OnboardingShell>
  )
}

export default Onboarding
