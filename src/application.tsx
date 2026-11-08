import { ConfigProvider, ThemeProvider } from 'musae'
import Layout from './layout'
import { ReactNode } from 'react'

const Application = ({ children }: { children: ReactNode }) => {
  return (
    <ConfigProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </ConfigProvider>
  )
}

export default Application
