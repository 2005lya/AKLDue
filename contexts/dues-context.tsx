import { useAuth } from '@/contexts/auth-context';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';

import { fetchDues } from '@/services/api';
import {
  syncDueNotifications,
} from '@/services/notifications';


export type RepeatUnit =
  | 'none'
  | 'week'
  | 'fortnight'
  | 'month'
  | 'quarter'
  | 'year';

export type SubscriptionType =
  | 'council'
  | 'rates'
  | 'vehicle';

export type Due = {
  id: string;
  title: string;
  source: string;
  dueDate: string;
  repeatUnit: RepeatUnit;
  excludedDates: string[];
  subscriptionType: SubscriptionType | null;
  subscriptionId: string | null;
  serviceType: string | null;
};

type DuesContextValue = {
  dues: Due[];
  setDues: Dispatch<SetStateAction<Due[]>>;
  isLoading: boolean;
  error: string | null;
  refreshDues: () => Promise<void>;
};

const DuesContext = createContext<DuesContextValue | null>(null);

type DuesProviderProps = {
  children: ReactNode;
};

export function DuesProvider({ children }: DuesProviderProps) {
  const { accessToken } = useAuth();
  const [dues, setDues] = useState<Due[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

 const refreshDues = useCallback(async () => {
  if (accessToken === null) {
    setDues([]);
    setError(null);
    setIsLoading(false);
    return;
  }

  try {
    setIsLoading(true);

    const apiDues = await fetchDues();

    setDues(apiDues);
    setError(null);
  } catch (error) {
  console.error('Loading dues failed:', error);
  setError(
    error instanceof Error
      ? error.message
      : 'Could not connect to the server.'
  );
  } finally {
    setIsLoading(false);
  }
}, [accessToken]);

useEffect(() => {
  refreshDues();
}, [refreshDues]);

useEffect(() => {
  if (accessToken === null || isLoading) {
    return;
  }

  syncDueNotifications(dues).catch((error) => {
    console.warn(
      'Could not schedule due notifications.',
      error
    );
  });
}, [accessToken, dues, isLoading]);

  return (
    <DuesContext.Provider
      value={{
        dues,
  setDues,
  isLoading,
  error,
  refreshDues,
      }}
    >
      {children}
    </DuesContext.Provider>
  );
}

export function useDues() {
  const context = useContext(DuesContext);

  if (context === null) {
    throw new Error('useDues must be used inside DuesProvider');
  }

  return context;
}