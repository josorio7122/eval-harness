import { NavLink, Outlet } from 'react-router'
import { Database, FlaskConical, GraduationCap } from 'lucide-react'

const navItems = [
  { to: '/datasets', label: 'Datasets', icon: Database },
  { to: '/graders', label: 'Graders', icon: GraduationCap },
  { to: '/experiments', label: 'Experiments', icon: FlaskConical },
]

export function Layout() {
  return (
    <div className="flex h-screen">
      <aside
        className="w-[220px] flex-shrink-0 border-r"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)' }}
      >
        <div className="p-4">
          <h1
            className="text-[16px] font-semibold tracking-tight"
            style={{ color: 'var(--fg-primary)' }}
          >
            Eval Harness
          </h1>
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-[13px] transition-colors ${
                  isActive ? 'border-l-2' : 'border-l-2 border-transparent'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--fg-primary)' : 'var(--fg-secondary)',
                borderLeftColor: isActive ? 'var(--accent-custom)' : 'transparent',
                background: isActive ? 'var(--bg-surface-1)' : 'transparent',
              })}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-base)' }}>
        <Outlet />
      </main>
    </div>
  )
}
