import createMDX from '@next/mdx'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const withMDX = createMDX({
  extension: /\.mdx?$/,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  // Pin tracing root to this marketing/ workspace; the parent claudecode-hub/
  // also has a package.json which Next.js otherwise mistakes for the root.
  outputFileTracingRoot: __dirname,
}

export default withMDX(nextConfig)
