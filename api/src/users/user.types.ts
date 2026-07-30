export type UserRole = 'admin' | 'officer' | 'viewer';

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  passwordHash: string;
  currentRefreshTokenHash?: string;
}

export type SafeUser = Omit<
  UserRecord,
  'passwordHash' | 'currentRefreshTokenHash'
>;

export interface UserListItem extends SafeUser {
  createdAt: string;
  updatedAt: string;
}
