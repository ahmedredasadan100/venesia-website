export const ADMIN_USERS_LIST_VIEW_KEY = "admin-users";

export type AdminUserColumnKey =
  | "username"
  | "email"
  | "fullName"
  | "role"
  | "status"
  | "lastLogin"
  | "created"
  | "actions";

type AdminUserColumnMeta = {
  key: AdminUserColumnKey;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
  sortable: boolean;
};

export const ADMIN_USERS_LIST_COLUMN_META = {
  username: {
    key: "username",
    label: "اسم المستخدم",
    defaultVisible: true,
    hideable: false,
    sortable: false,
  },
  email: {
    key: "email",
    label: "البريد الإلكتروني",
    defaultVisible: false,
    hideable: true,
    sortable: false,
  },
  fullName: {
    key: "fullName",
    label: "الاسم الكامل",
    defaultVisible: false,
    hideable: true,
    sortable: false,
  },
  role: {
    key: "role",
    label: "الدور",
    defaultVisible: true,
    hideable: true,
    sortable: false,
  },
  status: {
    key: "status",
    label: "الحالة",
    defaultVisible: true,
    hideable: true,
    sortable: false,
  },
  lastLogin: {
    key: "lastLogin",
    label: "آخر دخول",
    defaultVisible: true,
    hideable: true,
    sortable: false,
  },
  created: {
    key: "created",
    label: "تاريخ الإنشاء",
    defaultVisible: false,
    hideable: true,
    sortable: false,
  },
  actions: {
    key: "actions",
    label: "الإجراءات",
    defaultVisible: true,
    hideable: false,
    sortable: false,
  },
} as const satisfies Record<AdminUserColumnKey, AdminUserColumnMeta>;

const ADMIN_USERS_LIST_COLUMNS = Object.values(
  ADMIN_USERS_LIST_COLUMN_META,
);

export const ADMIN_USERS_DEFAULT_COLUMN_KEYS =
  ADMIN_USERS_LIST_COLUMNS.filter((column) => column.defaultVisible).map(
    (column) => column.key,
  ) as AdminUserColumnKey[];

export const ADMIN_USERS_PREFERENCE_COLUMN_KEYS =
  ADMIN_USERS_LIST_COLUMNS.filter((column) => column.hideable).map(
    (column) => column.key,
  ) as AdminUserColumnKey[];

export function getAdminUsersDefaultColumnKeys() {
  return ADMIN_USERS_DEFAULT_COLUMN_KEYS as readonly AdminUserColumnKey[];
}

export function getAdminUsersPreferenceColumnKeys() {
  return ADMIN_USERS_PREFERENCE_COLUMN_KEYS as readonly AdminUserColumnKey[];
}
