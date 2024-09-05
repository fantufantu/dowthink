import { ConfigProvider, ThemeProvider } from 'musae'
import Layout from './layout'

const Application = () => {
  return (
    <ConfigProvider>
      <ThemeProvider>
        <Layout />
      </ThemeProvider>
    </ConfigProvider>
  )
}

export default Application
