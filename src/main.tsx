import { bootstrap } from '@aiszlab/bee'
import Application from './application'
import Chat from './pages/chat'
import './index.css'

bootstrap({
  selectors: '#root',
  // TODO: remove
  render: Application,
  routes: [
    {
      path: '/',
      element: <Application />,
      children: [
        {
          path: 'chat',
          element: <Chat />
        }
      ]
    }
  ]
})
