"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

function getClientMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

export function useClientMounted() {
  return useSyncExternalStore(subscribeNoop, getClientMountedSnapshot, getServerMountedSnapshot);
}
