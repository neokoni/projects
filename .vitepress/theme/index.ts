import DefaultTheme from 'vitepress/theme'
import DocsHome from './components/DocsHome.vue'
import ProjectCard from './components/ProjectCard.vue'
import ProjectsHome from './components/ProjectsHome.vue'
import './styles/tailwind.css'
import './styles/overrides.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ProjectsHome', ProjectsHome)
    app.component('ProjectCard', ProjectCard)
    app.component('DocsHome', DocsHome)
  }
}
