import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, Badge, Icon, type IconName } from '../../components/ui';

const LINKS: [string, string, IconName][] = [
  ['/admin', 'Students', 'users'],
  ['/admin/labs', 'Labs & deadlines', 'calendar'],
  ['/admin/student-view', 'Student view', 'eye'],
  ['/admin/import', 'Import roster', 'file'],
  ['/admin/quiz-bank', 'Quiz bank', 'quiz'],
  ['/admin/submissions', 'Submissions', 'upload'],
  ['/admin/jobs', 'Jobs', 'activity'],
  ['/admin/audit', 'Audit log', 'shield'],
  ['/admin/settings', 'Settings', 'settings'],
];

export function AdminLayout() {
  const { context } = useAuth();
  // UI guard only; every admin RPC re-checks the role server-side.
  if (!context?.admin_role) return <Alert kind="error">You do not have access to the admin area.</Alert>;
  return (
    <div className="admin page">
      <nav aria-label="Admin" className="sidebar">
        <div className="sidebar-title">Course administration</div>
        {LINKS.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === '/admin'}>
            <Icon name={icon} size={17} />
            {label}
          </NavLink>
        ))}
        <div className="role-chip"><Badge tone="info" icon="shield">{context.admin_role}</Badge></div>
      </nav>
      <div>
        <Outlet />
      </div>
    </div>
  );
}

export const LAB_SLUGS = ['lab01', 'lab02', 'lab03'] as const;
