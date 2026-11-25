import { createDocsHost } from './help'

const host = createDocsHost({ context: { locale: 'en', theme: 'inherit', featureId: 'planner/pages/planner' } })
document.querySelector('#open')?.addEventListener('click', () => host.open({ topicId: 'planner/pages/planner' }))
