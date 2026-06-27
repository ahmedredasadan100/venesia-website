export const AUDIT_ACTIONS = {
  authLoginSuccess: "auth.login.success",
  authLoginFailed: "auth.login.failed",
  authLogout: "auth.logout",
  authPasswordChanged: "auth.password.changed",
  authSessionsRevoked: "auth.sessions.revoked",
  authEmailChanged: "auth.email.changed",
  adminUserCreated: "admin_user.created",
  adminUserUpdated: "admin_user.updated",
  adminUserActivated: "admin_user.activated",
  adminUserDeactivated: "admin_user.deactivated",
  adminUserPasswordReset: "admin_user.password.reset",
  adminUserDeleted: "admin_user.deleted",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "auth.login.success": "تسجيل دخول ناجح",
  "auth.login.failed": "فشل تسجيل الدخول",
  "auth.logout": "تسجيل خروج",
  "auth.password.changed": "تغيير كلمة المرور",
  "auth.sessions.revoked": "إبطال الجلسات",
  "auth.email.changed": "تغيير البريد الإلكتروني",
  "admin_user.created": "إنشاء مستخدم",
  "admin_user.updated": "تعديل مستخدم",
  "admin_user.activated": "تفعيل مستخدم",
  "admin_user.deactivated": "تعطيل مستخدم",
  "admin_user.password.reset": "تغيير كلمة مرور مستخدم",
  "admin_user.deleted": "حذف مستخدم",
};

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));
