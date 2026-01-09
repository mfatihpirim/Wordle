import { createFileRoute } from '@tanstack/react-router'

// When TanStack Router looks at my folder structure
// It sees src/routes/about.tsx
// It automatically assumes this code belongs to the /about url

// 
export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return <div className="p-2">Hello from About!</div>
}