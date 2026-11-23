import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'

// oxlint-disable-next-line import/no-unassigned-import -- a stylesheet is imported for its effect
import './styles.css'

const root = document.querySelector('#root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
