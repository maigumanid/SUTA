import {
  createContext,
  type Dispatch,
  ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { HouseholdInspection } from '@/types/householdInspection';

type InspectionContextType = {
  draftInspection: HouseholdInspection | null;
  setDraftInspection: Dispatch<
    SetStateAction<HouseholdInspection | null>
  >;
  clearDraftInspection: () => void;
};

const InspectionContext =
  createContext<InspectionContextType | null>(
    null
  );

export function InspectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const scopeKey = profile?.role === 'bsi'
    ? `${profile.uid}:${profile.assignedBarangayId}`
    : null;
  const previousScopeKey = useRef(scopeKey);
  const [
    draftInspection,
    setDraftInspection,
  ] = useState<HouseholdInspection | null>(
    null
  );

  const clearDraftInspection = () => {
    setDraftInspection(null);
  };

  useEffect(() => {
    if (previousScopeKey.current !== scopeKey) {
      setDraftInspection(null);
      previousScopeKey.current = scopeKey;
    }
  }, [scopeKey]);

  return (
    <InspectionContext.Provider
      value={{
        draftInspection,
        setDraftInspection,
        clearDraftInspection,
      }}
    >
      {children}
    </InspectionContext.Provider>
  );
}

export function useInspection() {
  const context =
    useContext(InspectionContext);

  if (!context) {
    throw new Error(
      'useInspection must be used inside InspectionProvider'
    );
  }

  return context;
}
