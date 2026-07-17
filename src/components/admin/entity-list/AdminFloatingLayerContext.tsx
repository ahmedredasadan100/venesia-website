"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AdminFloatingLayerContextValue = {
  openLayerId: string | null;
  setOpenLayerId: (id: string | null) => void;
  toggleLayer: (id: string) => void;
};

const AdminFloatingLayerContext =
  createContext<AdminFloatingLayerContextValue | null>(null);

/**
 * Ensures at most one floating menu is open within an entity list surface.
 */
export function AdminFloatingLayerProvider({ children }: { children: ReactNode }) {
  const [openLayerId, setOpenLayerId] = useState<string | null>(null);
  const toggleLayer = useCallback((id: string) => {
    setOpenLayerId((current) => (current === id ? null : id));
  }, []);

  const value = useMemo(
    () => ({ openLayerId, setOpenLayerId, toggleLayer }),
    [openLayerId, toggleLayer],
  );

  return (
    <AdminFloatingLayerContext.Provider value={value}>
      {children}
    </AdminFloatingLayerContext.Provider>
  );
}

export function useAdminFloatingLayer() {
  return useContext(AdminFloatingLayerContext);
}
