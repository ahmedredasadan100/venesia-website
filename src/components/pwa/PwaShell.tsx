"use client";

import InstallPrompt from "./InstallPrompt";
import PwaProvider from "./PwaProvider";

export default function PwaShell() {
  return (
    <PwaProvider>
      <InstallPrompt />
    </PwaProvider>
  );
}
