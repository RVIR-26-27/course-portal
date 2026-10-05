import { lazy, Suspense, useEffect, useState, type ReactElement } from 'react';
import { createHashRouter, Link, NavLink, Outlet, RouterProvider, useLocation } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Alert, Icon, Spinner } from './components/ui';
import { Claim } from './pages/Claim';
import { Dashboard } from './pages/Dashboard';
import { LabPage } from './pages/LabPage';
import { SignIn } from './pages/SignIn';
// Admin pages are a separate chunk: students never download them.
const lazyNamed = <K extends string>(load: () => Promise<Record<K, () => ReactElement>>, name: K) =>
  lazy(async () => ({ default: (await load())[name] }));
const AdminLayout = lazyNamed(() => import('./pages/admin/AdminLayout'), 'AdminLayout');
const Audit = lazyNamed(() => import('./pages/admin/Audit'), 'Audit');
const Import = lazyNamed(() => import('./pages/admin/Import'), 'Import');
const Jobs = lazyNamed(() => import('./pages/admin/Jobs'), 'Jobs');
const Labs = lazyNamed(() => import('./pages/admin/Labs'), 'Labs');
const QuizBank = lazyNamed(() => import('./pages/admin/QuizBank'), 'QuizBank');
const Settings = lazyNamed(() => import('./pages/admin/Settings'), 'Settings');
const StudentDetail = lazyNamed(() => import('./pages/admin/StudentDetail'), 'StudentDetail');
const Students = lazyNamed(() => import('./pages/admin/Students'), 'Students');
const Submissions = lazyNamed(() => import('./pages/admin/Submissions'), 'Submissions');
const StudentView = lazyNamed(() => import('./pages/admin/StudentView'), 'StudentView');

function Shell() {
  const { session, context, signOut } = useAuth();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden><Icon name="layers" size={17} /></span>
          <span>Flutter Intro Labs <span className="brand-sub">· RVIR</span></span>
        </Link>
        {session && (
          <button type="button" className="btn btn-ghost btn-small menu-toggle" aria-expanded={menu} aria-controls="topnav" onClick={() => setMenu((m) => !m)}>
            <Icon name="menu" /> <span className="sr-only">Menu</span>
          </button>
        )}
        <nav id="topnav" aria-label="Main" className={`topnav${menu ? ' open' : ''}`}>
          {session && <NavLink to="/" end>My labs</NavLink>}
          {context?.admin_role && <NavLink to="/admin">Admin</NavLink>}
          {session && (
            <button type="button" className="navbtn" onClick={() => void signOut()}>
              {context?.github_id && <img className="avatar" src={`https://avatars.githubusercontent.com/u/${context.github_id}?s=52`} alt="" />}
              Sign out{context?.github_login ? ` (@${context.github_login})` : ''}
            </button>
          )}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className={location.pathname.startsWith('/admin') ? 'wide' : undefined}>
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="footer">University of Maribor · FERI · optional Flutter introductory labs</footer>
    </>
  );
}

/** Signed in AND linked to a student record (or an admin). */
export function RequireStudent({ children, allowAdmin = false }: { children: ReactElement; allowAdmin?: boolean }) {
  const { session, ready, context, contextError } = useAuth();
  if (!ready) return <Spinner />;
  if (!session) return <SignIn />;
  if (contextError) return <Alert kind="error">{contextError}</Alert>;
  if (!context) return <Spinner label="Loading your account…" />;
  if (allowAdmin && context.admin_role && !context.student) return children;
  if (!context.student) return <Claim />;
  if (!context.student.identity_ok) return <Alert kind="error">Your GitHub identity does not match the linked account. Contact the course staff.</Alert>;
  return children;
}

function RequireAdmin({ children }: { children: ReactElement }) {
  const { session, ready, context } = useAuth();
  if (!ready) return <Spinner />;
  if (!session) return <SignIn />;
  if (!context) return <Spinner label="Loading your account…" />;
  return children;
}

function Home() {
  const { context } = useAuth();
  return (
    <RequireStudent allowAdmin>
      {context?.student ? <Dashboard /> : <Alert kind="info">You are signed in as staff. Open the <Link to="/admin">admin area</Link>, or see the portal as a student in the <Link to="/admin/student-view">student view</Link>.</Alert>}
    </RequireStudent>
  );
}

export const routes = [
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/labs/:lab', element: <RequireStudent><LabPage /></RequireStudent> },
      {
        path: '/admin',
        element: <RequireAdmin><AdminLayout /></RequireAdmin>,
        children: [
          { index: true, element: <Students /> },
          { path: 'students', element: <Students /> },
          { path: 'students/:id', element: <StudentDetail /> },
          { path: 'import', element: <Import /> },
          { path: 'labs', element: <Labs /> },
          { path: 'quiz-bank', element: <QuizBank /> },
          { path: 'jobs', element: <Jobs /> },
          { path: 'submissions', element: <Submissions /> },
          { path: 'audit', element: <Audit /> },
          { path: 'settings', element: <Settings /> },
          { path: 'student-view', element: <StudentView /> },
        ],
      },
      { path: '*', element: <Alert kind="warning">Page not found. <Link to="/">Back to the labs</Link></Alert> },
    ],
  },
];


// Hash routing: GitHub Pages serves a single index.html without server-side rewrites.
const router = createHashRouter(routes);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
