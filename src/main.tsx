import { bootstrap } from '@aiszlab/bee'
import Chat from './pages/chat'
import Layout from './layout'
import './index.css'

bootstrap({
  selectors: '#root',
  render: () => null,
  routes: [
    {
      path: '/',
      element: <Layout />,
      children: [
        {
          path: 'chat',
          element: <Chat />
        }
      ]
    }
  ]
})
