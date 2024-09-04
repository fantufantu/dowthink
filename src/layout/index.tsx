import { Bench } from 'musae'
import { Outlet } from 'react-router-dom'

const Layout = () => {
  return (
    <Bench>
      <Outlet />
    </Bench>
  )
}

export default Layout
