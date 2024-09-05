import { lazy, Suspense } from 'react'
import { AddAlert, AutoDelete } from 'musae/icons'
import { useTheme } from 'musae'

const Outlet = lazy(() => import('@aiszlab/bee/router').then((router) => ({ default: router.Outlet })))

const Layout = () => {
  const theme = useTheme()

  return (
    <div className='w-screen h-screen flex flex-col'>
      <header className='py-2 px-2'>12321321</header>

      <div className='flex-1 flex flex-row'>
        <aside className='flex flex-col gap-2 px-2'>
          <AddAlert size='large' />
          <AutoDelete size='large' />
        </aside>

        <main className='flex-1 rounded-l-3xl' style={{ backgroundColor: theme.colors['surface-container'] }}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default Layout
