const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{2,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAdminUsername(value: string) {
  return value.trim();
}

export function normalizeAdminEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeAdminFullName(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function validateAdminUsername(username: string) {
  const normalized = normalizeAdminUsername(username);
  if (!normalized) return "اسم المستخدم مطلوب.";
  if (!USERNAME_PATTERN.test(normalized)) {
    return "اسم المستخدم يجب أن يكون بين 2 و64 حرفًا (حروف، أرقام، . _ -).";
  }
  return null;
}

export function validateAdminEmail(email: string) {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) return "البريد الإلكتروني مطلوب.";
  if (!EMAIL_PATTERN.test(normalized)) return "أدخل بريدًا إلكترونيًا صالحًا.";
  return null;
}

export function validateAdminPasswordPair(password: string, confirmPassword: string) {
  if (!password) return "كلمة المرور مطلوبة.";
  if (password.length < 6) return "كلمة المرور يجب أن تكون 6 أحرف على الأقل.";
  if (password !== confirmPassword) return "تأكيد كلمة المرور غير متطابق.";
  return null;
}

export type AdminUserEditPasswordField = "password" | "confirmPassword";

export type AdminUserEditPasswordFieldErrors = Partial<Record<AdminUserEditPasswordField, string>>;

export function hasAdminUserEditPasswordFieldErrors(errors: AdminUserEditPasswordFieldErrors) {
  return Object.keys(errors).length > 0;
}

export function validateAdminOptionalPasswordFields(
  password: string,
  confirmPassword: string,
): AdminUserEditPasswordFieldErrors {
  const errors: AdminUserEditPasswordFieldErrors = {};
  const normalizedPassword = password.trim();
  const normalizedConfirm = confirmPassword.trim();

  if (!normalizedPassword && !normalizedConfirm) return errors;

  if (!normalizedPassword) {
    errors.password = "هذا الحقل مطلوب";
  } else if (normalizedPassword.length < 6) {
    errors.password = "كلمة المرور قصيرة";
  }

  if (!normalizedConfirm) {
    errors.confirmPassword = "هذا الحقل مطلوب";
  } else if (normalizedPassword && normalizedPassword !== normalizedConfirm) {
    errors.confirmPassword = "تأكيد كلمة المرور غير متطابق";
  }

  return errors;
}

export function validateAdminFullName(fullName: string | null) {
  if (fullName && fullName.length > 120) return "الاسم الكامل طويل جدًا.";
  return null;
}

export type AdminUserCreateField = "username" | "email" | "full_name" | "password" | "confirmPassword";

export type AdminUserCreateFieldErrors = Partial<Record<AdminUserCreateField, string>>;

export class AdminUserCreateValidationError extends Error {
  fieldErrors: AdminUserCreateFieldErrors;

  constructor(fieldErrors: AdminUserCreateFieldErrors) {
    super("CREATE_USER_VALIDATION");
    this.name = "AdminUserCreateValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function hasAdminUserCreateFieldErrors(errors: AdminUserCreateFieldErrors) {
  return Object.keys(errors).length > 0;
}

export function validateAdminCreateUserForm(input: {
  username: string;
  email: string;
  full_name: string;
  password: string;
  confirmPassword: string;
}): AdminUserCreateFieldErrors {
  const errors: AdminUserCreateFieldErrors = {};
  const username = normalizeAdminUsername(input.username);
  const email = normalizeAdminEmail(input.email);
  const fullName = normalizeAdminFullName(input.full_name);

  if (!username) {
    errors.username = "هذا الحقل مطلوب";
  } else {
    const usernameError = validateAdminUsername(username);
    if (usernameError && usernameError !== "اسم المستخدم مطلوب.") {
      errors.username = usernameError;
    }
  }

  if (!email) {
    errors.email = "هذا الحقل مطلوب";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "البريد الإلكتروني غير صحيح";
  }

  if (!input.password) {
    errors.password = "هذا الحقل مطلوب";
  } else if (input.password.length < 6) {
    errors.password = "كلمة المرور قصيرة";
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = "هذا الحقل مطلوب";
  } else if (input.password && input.password !== input.confirmPassword) {
    errors.confirmPassword = "تأكيد كلمة المرور غير متطابق";
  }

  const fullNameError = validateAdminFullName(fullName);
  if (fullNameError) errors.full_name = fullNameError;

  return errors;
}

export function mapUniqueViolationToCreateFieldErrors(error: { message?: string; details?: string }) {
  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  const fieldErrors: AdminUserCreateFieldErrors = {};

  if (haystack.includes("username") || haystack.includes("(username)")) {
    fieldErrors.username = "اسم المستخدم مستخدم بالفعل";
  }
  if (haystack.includes("email") || haystack.includes("(email)")) {
    fieldErrors.email = "البريد الإلكتروني مستخدم بالفعل";
  }
  if (!fieldErrors.username && !fieldErrors.email) {
    fieldErrors.username = "اسم المستخدم مستخدم بالفعل";
  }

  return fieldErrors;
}

export type AdminSelfAccountField = "full_name" | "email" | "currentPassword";

export type AdminSelfAccountFieldErrors = Partial<Record<AdminSelfAccountField, string>>;

export class AdminSelfAccountValidationError extends Error {
  fieldErrors: AdminSelfAccountFieldErrors;

  constructor(fieldErrors: AdminSelfAccountFieldErrors) {
    super("SELF_ACCOUNT_VALIDATION");
    this.name = "AdminSelfAccountValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function hasAdminSelfAccountFieldErrors(errors: AdminSelfAccountFieldErrors) {
  return Object.keys(errors).length > 0;
}

export function validateAdminSelfAccountForm(input: {
  full_name: string;
  email: string;
  currentPassword: string;
  originalEmail: string;
}): AdminSelfAccountFieldErrors {
  const errors: AdminSelfAccountFieldErrors = {};
  const fullName = normalizeAdminFullName(input.full_name);
  const fullNameError = validateAdminFullName(fullName);
  if (fullNameError) errors.full_name = fullNameError;

  const emailError = validateAdminEmail(input.email);
  if (emailError) errors.email = emailError;

  const emailChanged = normalizeAdminEmail(input.email) !== normalizeAdminEmail(input.originalEmail);
  if (emailChanged && !input.currentPassword.trim()) {
    errors.currentPassword = "هذا الحقل مطلوب لتغيير البريد الإلكتروني";
  }

  return errors;
}

export function mapUniqueViolationToSelfAccountFieldErrors(error: { message?: string; details?: string }) {
  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  const fieldErrors: AdminSelfAccountFieldErrors = {};

  if (haystack.includes("email") || haystack.includes("(email)")) {
    fieldErrors.email = "البريد الإلكتروني مستخدم بالفعل";
  }

  return fieldErrors;
}
