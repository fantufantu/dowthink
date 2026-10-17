import { NavLink, useLocation, useNavigate } from '@aiszlab/bee/router'
import { IconHistory, IconToday, IconCalendarMonth } from 'musae/icons/action'
import { IconAdd, IconInbox } from 'musae/icons/content'
import { IconButton } from 'musae'

const items = [
  { to: '/', label: '今日', icon: IconToday },
  { to: '/inbox', label: '收件箱', icon: IconInbox },
  { to: '/review', label: '复盘', icon: IconHistory },
  { to: '/planner', label: '计划', icon: IconCalendarMonth }
]

const BottomNavigation = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return <nav className='bottom-navigation' aria-label='主导航'>
    {items.slice(0, 2).map((item) => (
      <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-navigation__item${isActive ? ' is-active' : ''}`}>
        <span className='bottom-navigation__icon' aria-hidden='true'><item.icon size={20} /></span>
        <span>{item.label}</span>
      </NavLink>
    ))}
    <div className={`bottom-navigation__add${pathname === '/tasks/new' ? ' is-active' : ''}`}>
      <IconButton
        className='bottom-navigation__icon-button'
        type='button'
        size='large'
        onClick={() => navigate('/tasks/new')}
      >
        <span className='sr-only'>添加待办</span>
        <span aria-hidden='true'><IconAdd size={24} /></span>
      </IconButton>
      <span aria-hidden='true'>添加</span>
    </div>
    {items.slice(2).map((item) => (
      <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-navigation__item${isActive ? ' is-active' : ''}`}>
        <span className='bottom-navigation__icon' aria-hidden='true'><item.icon size={20} /></span>
        <span>{item.label}</span>
      </NavLink>
    ))}
  </nav>
}

export default BottomNavigation
