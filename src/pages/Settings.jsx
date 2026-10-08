import { useTranslation } from 'react-i18next'

import AboutCard from '../components/settings/AboutCard.jsx'
import AccountCard from '../components/settings/AccountCard.jsx'
import AccountDeleteModal from '../components/settings/AccountDeleteModal.jsx'
import LanguageCard from '../components/settings/LanguageCard.jsx'
import ProfileCard from '../components/settings/ProfileCard.jsx'
import ReadingPreferencesCard from '../components/settings/ReadingPreferencesCard.jsx'
import { settingsLarge } from '../components/settings/settingsResponsive.js'
import useSettings from '../hooks/useSettings.js'

function Settings() {
  const { t } = useTranslation()
  const {
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
  } = useSettings()

  return (
    <div className={`w-full min-w-0 ${settingsLarge.shell}`}>
      <div className={settingsLarge.content}>
        <header className={`dp-page-enter py-4 ${settingsLarge.headerTop}`}>
          <h1
            className={`
              mt-2 font-heading text-3xl font-bold text-darkwood md:text-4xl
              ${settingsLarge.pageTitle}
            `}
          >
            {t('settings.title')}
          </h1>

          <p
            className={`
              mt-2 max-w-2xl font-ui text-sm font-semibold leading-relaxed
              text-darkwood/60 md:text-base
              ${settingsLarge.pageDescription}
            `}
          >
            {t('settings.description')}
          </p>
        </header>

        {user && (
          <div
            className={`dp-card-list-enter dp-section-enter mt-6 grid gap-6 ${settingsLarge.stack}`}
          >
            <ProfileCard
              user={user}
              displayName={displayName}
              isEditing={isEditingProfile}
              isSaving={isSavingProfile}
              error={profileError}
              successMessage={profileSuccessMessage}
              onEdit={startProfileEditing}
              onCancel={cancelProfileEditing}
              onDisplayNameChange={handleDisplayNameChange}
              onSave={handleProfileSave}
            />

            <LanguageCard />

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
              onDeleteRequest={openDeleteModal}
              onLogout={handleLogout}
            />

            <AboutCard />
          </div>
        )}
      </div>

      <AccountDeleteModal
        error={deleteError}
        isDeleting={isDeletingAccount}
        isOpen={isDeleteModalOpen}
        user={user}
        onClose={closeDeleteModal}
        onDelete={handleDeleteAccount}
      />
    </div>
  )
}

export default Settings
