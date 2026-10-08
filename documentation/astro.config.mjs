
  // @ts-check
  import { defineConfig } from 'astro/config'
  import starlight from '@astrojs/starlight'

  export default defineConfig({
    integrations: [
      starlight({
        title: 'Dear Pages',

        locales: {
          root: {
            label: 'FR',
            lang: 'fr',
          },
          en: {
            label: 'EN',
            lang: 'en',
          },
        },

        customCss: [
          './src/styles/booktracker.css',
        ],

        components: {
          ThemeSelect: './src/components/EmptyThemeSelect.astro',
          LanguageSelect: './src/components/LanguageSelect.astro',
        },

        social: [
          {
            icon: 'github',
            label: 'GitHub',
            href: 'https://github.com/bldyonyx/BookTracker',
          },
        ],

        sidebar: [
          {
            label: 'Introduction',
            translations: { en: 'Introduction' },
            items: [
              {
                label: 'Présentation',
                translations: { en: 'Overview' },
                slug: 'index',
              },
              {
                label: 'Fonctionnalités',
                translations: { en: 'Features' },
                slug: 'introduction/fonctionnalites',
              },
            ],
          },
          {
            label: 'Architecture',
            translations: { en: 'Architecture' },
            items: [
              {
                label: 'Structure du projet',
                translations: { en: 'Project structure' },
                slug: 'architecture/structure',
              },
              {
                label: 'Routing',
                translations: { en: 'Routing' },
                slug: 'architecture/routing',
              },
              {
                label: 'Composants',
                translations: { en: 'Components' },
                slug: 'architecture/composants',
              },
            ],
          },
          {
            label: 'API & données',
            translations: { en: 'API & data' },
            items: [
              {
                label: 'Sources de livres',
                translations: { en: 'Book sources' },
                slug: 'data/google-books',
              },
              {
                label: 'Modèle de données',
                translations: { en: 'Data model' },
                slug: 'data/modele',
              },
              {
                label: 'Recommandations',
                translations: { en: 'Recommendations' },
                slug: 'data/recommendations',
              },
              {
                label: 'Traduction',
                translations: { en: 'Translation' },
                slug: 'data/translation',
              },
              {
                label: 'Firebase',
                translations: { en: 'Firebase' },
                slug: 'data/firebase',
              },
            ],
          },
          {
            label: 'Développement',
            translations: { en: 'Development' },
            items: [
              {
                label: 'Installation',
                translations: { en: 'Installation' },
                slug: 'development/installation',
              },
              {
                label: "Variables d'environnement",
                translations: { en: 'Environment variables' },
                slug: 'development/environment',
              },
              {
                label: 'Scripts',
                translations: { en: 'Scripts' },
                slug: 'development/scripts',
              },
              {
                label: 'JSDoc',
                translations: { en: 'JSDoc' },
                slug: 'development/jsdoc',
              },
            ],
          },
          {
            label: 'Projet',
            translations: { en: 'Project' },
            items: [
              {
                label: 'Responsive',
                translations: { en: 'Responsive' },
                slug: 'project/responsive',
              },
              {
                label: 'Choix techniques',
                translations: { en: 'Technical choices' },
                slug: 'project/technical-choices',
              },
              {
                label: 'Roadmap',
                translations: { en: 'Roadmap' },
                slug: 'project/roadmap',
              },
            ],
          },
        ],
      }),
    ],
  })
