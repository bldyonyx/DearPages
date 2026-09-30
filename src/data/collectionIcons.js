import {
  BookHeart,
  BookMarked,
  BookOpen,
  Bookmark,
  CakeSlice,
  Castle,
  CircleAlert,
  Clover,
  Coffee,
  Crown,
  Feather,
  Flame,
  Flower2,
  Gem,
  Ghost,
  Glasses,
  Heart,
  HeartCrack,
  LibraryBig,
  Lightbulb,
  Moon,
  Music2,
  PawPrint,
  Plane,
  Rainbow,
  Rocket,
  Shell,
  Skull,
  Sparkles,
  Star,
  Sun,
  Telescope,
  ThumbsDown,
  Trees,
  WandSparkles,
  Zap,
} from 'lucide-react'

export const DEFAULT_COLLECTION_ICON = 'library'

export const COLLECTION_ICONS = [
  {
    id: 'library',
    label: 'Bibliothèque',
    icon: LibraryBig,
  },
  {
    id: 'book',
    label: 'Livres',
    icon: BookOpen,
  },
  {
    id: 'book-marked',
    label: 'Sélection',
    icon: BookMarked,
  },
  {
    id: 'bookmark',
    label: 'À garder',
    icon: Bookmark,
  },
  {
    id: 'heart',
    label: 'Coup de cœur',
    icon: Heart,
  },
  {
    id: 'book-heart',
    label: 'Livres aimés',
    icon: BookHeart,
  },
  {
    id: 'star',
    label: 'Favoris',
    icon: Star,
  },
  {
    id: 'sparkles',
    label: 'Pépites',
    icon: Sparkles,
  },
  {
    id: 'crown',
    label: 'Royauté',
    icon: Crown,
  },
  {
    id: 'gem',
    label: 'Trésors',
    icon: Gem,
  },
  {
    id: 'thumbs-down',
    label: 'Déceptions',
    icon: ThumbsDown,
  },
  {
    id: 'heart-crack',
    label: 'Cœurs brisés',
    icon: HeartCrack,
  },
  {
    id: 'alert',
    label: 'À éviter',
    icon: CircleAlert,
  },
  {
    id: 'skull',
    label: 'Catastrophes',
    icon: Skull,
  },
  {
    id: 'moon',
    label: 'Lectures du soir',
    icon: Moon,
  },
  {
    id: 'sun',
    label: 'Lectures lumineuses',
    icon: Sun,
  },
  {
    id: 'flower',
    label: 'Cozy',
    icon: Flower2,
  },
  {
    id: 'clover',
    label: 'Porte-bonheur',
    icon: Clover,
  },
  {
    id: 'coffee',
    label: 'Détente',
    icon: Coffee,
  },
  {
    id: 'cake',
    label: 'Douceur',
    icon: CakeSlice,
  },
  {
    id: 'rainbow',
    label: 'Feel good',
    icon: Rainbow,
  },
  {
    id: 'wand',
    label: 'Fantasy',
    icon: WandSparkles,
  },
  {
    id: 'castle',
    label: 'Imaginaire',
    icon: Castle,
  },
  {
    id: 'ghost',
    label: 'Spooky',
    icon: Ghost,
  },
  {
    id: 'flame',
    label: 'Intense',
    icon: Flame,
  },
  {
    id: 'zap',
    label: 'Addictif',
    icon: Zap,
  },
  {
    id: 'feather',
    label: 'Littérature',
    icon: Feather,
  },
  {
    id: 'glasses',
    label: 'Classiques',
    icon: Glasses,
  },
  {
    id: 'lightbulb',
    label: 'À réfléchir',
    icon: Lightbulb,
  },
  {
    id: 'music',
    label: 'Musique',
    icon: Music2,
  },
  {
    id: 'paw',
    label: 'Animaux',
    icon: PawPrint,
  },
  {
    id: 'trees',
    label: 'Nature',
    icon: Trees,
  },
  {
    id: 'shell',
    label: 'Évasion',
    icon: Shell,
  },
  {
    id: 'plane',
    label: 'Voyage',
    icon: Plane,
  },
  {
    id: 'telescope',
    label: 'Exploration',
    icon: Telescope,
  },
  {
    id: 'rocket',
    label: 'Science-fiction',
    icon: Rocket,
  },
]

export function getCollectionIcon(iconId) {
  return (
    COLLECTION_ICONS.find((item) => item.id === iconId) ||
    COLLECTION_ICONS.find(
      (item) => item.id === DEFAULT_COLLECTION_ICON
    )
  )
}