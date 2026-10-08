const mainNavigationItems = [
  { labelKey: 'navigation.home', to: '/' },
  { labelKey: 'navigation.discover', to: '/discover' },
  { labelKey: 'navigation.library', to: '/library' },
  { labelKey: 'navigation.collections', to: '/collections' },
]

const desktopNavigationItems = [
  mainNavigationItems[0],
  mainNavigationItems[1],
  { labelKey: 'navigation.myLibrary', to: '/library' },
  mainNavigationItems[3],
  { labelKey: 'navigation.settings', to: '/settings' },
]

export { desktopNavigationItems, mainNavigationItems }
