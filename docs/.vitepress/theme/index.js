import DefaultTheme from 'vitepress/theme'
import './style.css'
import DocLayout from './layouts/DocLayout.vue'
import BackToTop from './components/BackToTop.vue'

export default {
  ...DefaultTheme,
  Layout: DocLayout,
  async enhanceApp({ app }) {
    app.component('BackToTop', BackToTop)
  }
}
