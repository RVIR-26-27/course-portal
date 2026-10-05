import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AuthContext, type AuthValue } from '../src/auth/AuthProvider';

export function withAuth(ui: ReactNode, value: Partial<AuthValue>, path = '/') {
  const v: AuthValue = {
    session: null, ready: true, context: null, contextError: null,
    refresh: async () => undefined, signIn: async () => undefined, signOut: async () => undefined,
    ...value,
  };
  return (
    <AuthContext.Provider value={v}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
}

export const fakeSession = { access_token: 't', user: { id: 'u1' } } as unknown as AuthValue['session'];
