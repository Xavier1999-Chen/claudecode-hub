import type { MDXComponents } from 'mdx/types'
import Hero from '@/components/Hero'
import FeatureCards from '@/components/FeatureCards'
import PersonaCards from '@/components/PersonaCards'
import Pricing from '@/components/Pricing'
import BottomCTA from '@/components/BottomCTA'

// Register custom components for use inside .mdx files.
// MDX content (e.g. content/home.mdx) can use these as JSX.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Hero,
    FeatureCards,
    PersonaCards,
    Pricing,
    BottomCTA,
    ...components,
  }
}
