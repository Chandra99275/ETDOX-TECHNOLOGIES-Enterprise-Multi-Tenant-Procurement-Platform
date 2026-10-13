export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  title?: string;
  phone?: string;
  departmentId?: string;
  roleIds: string[];
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  title?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
}
