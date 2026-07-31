"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import AdminConfirmDialog from "../ui/AdminConfirmDialog";

export type AdminEntityListConfirmationSnapshot = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  resolveReturnFocus?: () => HTMLElement | null;
};

type AdminFloatingLayerContextValue = {
  openLayerId: string | null;
  setOpenLayerId: (id: string | null) => void;
  toggleLayer: (id: string) => void;
  openConfirmation: (snapshot: AdminEntityListConfirmationSnapshot) => void;
};

const AdminFloatingLayerContext =
  createContext<AdminFloatingLayerContextValue | null>(null);

/**
 * Ensures at most one floating menu is open within an entity list surface.
 */
export function AdminFloatingLayerProvider({
  children,
  fallbackFocusRef,
}: {
  children: ReactNode;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [openLayerId, setOpenLayerId] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<AdminEntityListConfirmationSnapshot | null>(null);
  const toggleLayer = useCallback((id: string) => {
    setOpenLayerId((current) => (current === id ? null : id));
  }, []);
  const openConfirmation = useCallback(
    (snapshot: AdminEntityListConfirmationSnapshot) => {
      setOpenLayerId(null);
      setConfirmation(snapshot);
    },
    [],
  );
  const closeConfirmation = useCallback(() => setConfirmation(null), []);
  const confirm = useCallback(async () => {
    const activeConfirmation = confirmation;
    if (!activeConfirmation) return;

    await activeConfirmation.onConfirm();
    setConfirmation((current) =>
      current === activeConfirmation ? null : current,
    );
  }, [confirmation]);

  const value = useMemo(
    () => ({ openLayerId, setOpenLayerId, toggleLayer, openConfirmation }),
    [openConfirmation, openLayerId, toggleLayer],
  );

  return (
    <AdminFloatingLayerContext.Provider value={value}>
      {children}
      <AdminConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? "تأكيد الإجراء"}
        description={confirmation?.description ?? ""}
        confirmLabel={confirmation?.confirmLabel ?? "تأكيد"}
        cancelLabel={confirmation?.cancelLabel}
        returnFocusRef={confirmation?.returnFocusRef}
        fallbackFocusRef={fallbackFocusRef}
        resolveReturnFocus={confirmation?.resolveReturnFocus}
        onCancel={closeConfirmation}
        onConfirm={confirm}
      />
    </AdminFloatingLayerContext.Provider>
  );
}

export function useAdminFloatingLayer() {
  return useContext(AdminFloatingLayerContext);
}
