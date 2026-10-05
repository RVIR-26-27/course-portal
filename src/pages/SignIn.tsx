import { useAuth } from '../auth/AuthProvider';
import { configured } from '../lib/supabase';
import { Alert } from '../components/ui';

export function SignIn() {
  const { signIn } = useAuth();
  return (
    <section className="card narrow">
      <h1>Flutter Mobile Development — Intro Labs</h1>
      <p>
        Three optional introductory labs: UI &amp; navigation, local persistence, and networking &amp; authentication. Each lab has a short
        learning module, a readiness quiz and a personal programming assignment.
      </p>
      {!configured && <Alert kind="warning">The portal is not configured (missing Supabase URL/key).</Alert>}
      <button type="button" className="btn btn-primary btn-large" onClick={() => void signIn()}>
        Sign in with GitHub
      </button>
      <p className="muted small">
        Only your GitHub identity (numeric id and login) is used. The portal never asks for access to your repositories.
      </p>
    </section>
  );
}
