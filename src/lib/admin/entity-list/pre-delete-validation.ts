export type AdminDeleteDependency = {
  key: string;
  count: number;
};

export type AdminPreDeleteValidation = {
  dependencies: readonly AdminDeleteDependency[];
  blocked: boolean;
};

export function createAdminPreDeleteValidation(
  dependencies: readonly AdminDeleteDependency[],
): AdminPreDeleteValidation {
  const present = dependencies.filter(
    (dependency) => Number.isInteger(dependency.count) && dependency.count > 0,
  );
  return {
    dependencies: present,
    blocked: present.length > 0,
  };
}
