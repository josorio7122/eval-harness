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
      <aside className="w-[220px] flex-shrink-0 border-r border-border bg-background">
        <div className="p-4">
          <h1 className="text-[16px] font-semibold tracking-tight text-foreground">Eval Harness</h1>
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors border-l-2 ${
                  isActive
                    ? 'border-l-primary bg-primary/8 text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:bg-card hover:text-foreground'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  )
}
