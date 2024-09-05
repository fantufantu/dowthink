import { bootstrap } from '@aiszlab/bee'
import Application from './application'
import Chat from './pages/chat'
import './index.css'
import Home from './pages/home'

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
          path: '/',
          element: <Home />
        },
        {
          path: 'chat',
          element: <Chat />
        }
      ]
    }
  ]
})
