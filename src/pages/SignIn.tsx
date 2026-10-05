import { useAuth } from '../auth/AuthProvider';
import { configured } from '../lib/supabase';
import { Alert, Icon } from '../components/ui';

export function SignIn() {
  const { signIn } = useAuth();
  return (
    <section className="signin page">
      <div>
        <div className="eyebrow">Mobile app development · optional labs</div>
        <h1>Flutter Mobile Development — Intro Labs</h1>
        <p className="lead">
          Three optional introductory labs: UI &amp; navigation, local persistence, and networking &amp; authentication. Each lab has a short
          learning module, a readiness quiz and a personal programming assignment.
        </p>
        <ul className="feature-list">
          <li><Icon name="book" /><span><strong>Learn</strong> — a focused module with code you will reuse in the assignment.</span></li>
          <li><Icon name="quiz" /><span><strong>Check yourself</strong> — a short readiness quiz unlocks your personal repository.</span></li>
          <li><Icon name="code" /><span><strong>Build</strong> — your own variant of the assignment in a private GitHub repository.</span></li>
          <li><Icon name="upload" /><span><strong>Get feedback</strong> — submit an exact commit and see the result per category.</span></li>
        </ul>
      </div>
      <div className="card signin-card">
        <h2>Sign in</h2>
        <p className="muted small">Use the GitHub account you will do the assignments with.</p>
        {!configured && <Alert kind="warning">The portal is not configured (missing Supabase URL/key).</Alert>}
        <button type="button" className="btn btn-primary btn-large btn-block" onClick={() => void signIn()}>
          <Icon name="github" size={20} />Sign in with GitHub
        </button>
        <p className="muted small">
          Only your GitHub identity (numeric id and login) is used. The portal never asks for access to your repositories.
        </p>
      </div>
    </section>
  );
}
