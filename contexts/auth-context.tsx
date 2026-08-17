import {
  useClerk,
  useAuth as useClerkAuth,
  useSession,
  useUser,
} from '@clerk/expo';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  setAccessTokenProvider,
} from '@/services/auth-session';
import { ActivityIndicator } from 'react-native';

type AuthContextValue = {
  accessToken: string | null;
  email: string | null;
  isAuthLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext =
  createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
 const {
  isLoaded,
  isSignedIn,
} = useClerkAuth();

const {
  isLoaded: isSessionLoaded,
  session,
} = useSession();

  const [
  registeredSessionId,
  setRegisteredSessionId,
] = useState<string | null>(null);

const expectedSessionId =
  session?.id ?? 'signed-out';

  const { user } = useUser();
  const { signOut: clerkSignOut } = useClerk();

useEffect(() => {
  const removeProvider = setAccessTokenProvider(
    async () => {
      if (session === null || session === undefined) {
        return null;
      }

      return session.getToken();
    }
  );

  setRegisteredSessionId(expectedSessionId);

  return removeProvider;
}, [session, expectedSessionId]);

  async function signOut() {
    await clerkSignOut();
  }

  const email =
    user?.primaryEmailAddress?.emailAddress ?? null;

if (
  !isLoaded ||
  !isSessionLoaded ||
  registeredSessionId !== expectedSessionId
) {
  return <ActivityIndicator style={{ flex: 1 }} />;
}

  return (
    <AuthContext.Provider
      value={{
        accessToken:
          isLoaded && isSignedIn
            ? 'clerk-session'
            : null,
        email,
        isAuthLoading: !isLoaded,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}
