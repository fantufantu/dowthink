import { bootstrap } from '@aiszlab/bee'
import Application from './application'
import 'musae/styles.css'
import './index.css'
import Today from './pages/today'
import Inbox from './pages/inbox'
import Review from './pages/review'
import Planner from './pages/planner'
import NewTask from './pages/new-task'

bootstrap({
  selectors: '#root',
  render: Application,
  routes: [
    {
      path: '/',
      element: <Application />,
      children: [
        {
          index: true,
          element: <Today />
        },
        { path: 'inbox', element: <Inbox /> },
        { path: 'review', element: <Review /> },
        { path: 'planner', element: <Planner /> },
        { path: 'tasks/new', element: <NewTask /> }
      ]
    }
  ]
})
