import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { Alert } from '../../components/ui';

const LINKS = [
  ['/admin', 'Students'],
  ['/admin/import', 'Import'],
  ['/admin/labs', 'Labs'],
  ['/admin/quiz-bank', 'Quiz bank'],
  ['/admin/jobs', 'Jobs'],
  ['/admin/submissions', 'Submissions'],
  ['/admin/audit', 'Audit'],
  ['/admin/settings', 'Settings'],
] as const;

export function AdminLayout() {
  const { context } = useAuth();
  // UI guard only; every admin RPC re-checks the role server-side.
  if (!context?.admin_role) return <Alert kind="error">You do not have access to the admin area.</Alert>;
  return (
    <section>
      <h1>
        Course administration <span className="muted small">({context.admin_role})</span>
      </h1>
      <nav aria-label="Admin" className="subnav">
        {LINKS.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/admin'}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </section>
  );
}

export const LAB_SLUGS = ['lab01', 'lab02', 'lab03'] as const;
