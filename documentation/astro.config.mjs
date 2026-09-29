// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  integrations: [
    starlight({
      title: 'Dear Pages',

      locales: {
        root: {
          label: 'Français',
          lang: 'fr',
        },
      },

      customCss: [
        './src/styles/booktracker.css',
      ],

      components: {
        ThemeSelect: './src/components/EmptyThemeSelect.astro',
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
          items: [
            { label: 'Présentation', slug: 'index' },
            {
              label: 'Fonctionnalités',
              slug: 'introduction/fonctionnalites',
            },
          ],
        },
        {
          label: 'Architecture',
          items: [
            {
              label: 'Structure du projet',
              slug: 'architecture/structure',
            },
            {
              label: 'Routing',
              slug: 'architecture/routing',
            },
            {
              label: 'Composants',
              slug: 'architecture/composants',
            },
          ],
        },
        {
          label: 'API & données',
          items: [
            {
              label: 'Sources de livres',
              slug: 'data/google-books',
            },
            {
              label: 'Modèle de données',
              slug: 'data/modele',
            },
            {
              label: 'Recommandations',
              slug: 'data/recommendations',
            },
            {
              label: 'Traduction',
              slug: 'data/translation',
            },
            {
              label: 'Firebase',
              slug: 'data/firebase',
            },
          ],
        },
        {
          label: 'Développement',
          items: [
            {
              label: 'Installation',
              slug: 'development/installation',
            },
            {
              label: "Variables d'environnement",
              slug: 'development/environment',
            },
            {
              label: 'Scripts',
              slug: 'development/scripts',
            },
            {
              label: 'JSDoc',
              slug: 'development/jsdoc',
            },
          ],
        },
        {
          label: 'Projet',
          items: [
            {
              label: 'Responsive',
              slug: 'project/responsive',
            },
            {
              label: 'Choix techniques',
              slug: 'project/technical-choices',
            },
            {
              label: 'Roadmap',
              slug: 'project/roadmap',
            },
          ],
        },
      ],
    }),
  ],
})
