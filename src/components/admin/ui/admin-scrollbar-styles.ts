/**
 * Shared Admin scrollbar visuals only.
 *
 * Consumers retain their own overflow and sizing rules so this token can be
 * reused by menus, listboxes, and other bounded surfaces without coupling
 * their behavior.
 */
export const ADMIN_SCROLLBAR_VISUAL_CLASSES =
  "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.24)_rgba(255,255,255,0.06)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/30";
