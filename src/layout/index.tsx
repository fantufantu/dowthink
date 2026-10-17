import { Suspense } from 'react'
import BottomNavigation from '../components/bottom-navigation'

import { Outlet } from '@aiszlab/bee/router'

const Layout = () => {
  return (
    <div className='app-shell'>
      <div className='app-shell__content'><Suspense fallback={<div className='loading-state'>正在打开…</div>}><Outlet /></Suspense></div>
      <BottomNavigation />
    </div>
  )
}

export default Layout
