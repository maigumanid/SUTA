import {
  createContext,
  ReactNode,
  useContext,
  useState,
} from 'react';

import { HouseholdInspection } from '@/types/householdInspection';

type InspectionContextType = {
  draftInspection: HouseholdInspection | null;
  setDraftInspection: (
    inspection: HouseholdInspection | null
  ) => void;
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
  const [
    draftInspection,
    setDraftInspection,
  ] = useState<HouseholdInspection | null>(
    null
  );

  const clearDraftInspection = () => {
    setDraftInspection(null);
  };

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
