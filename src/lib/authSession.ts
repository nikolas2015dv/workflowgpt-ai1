import type { AppUser } from '../types/user';

let currentUser: AppUser | null = null;

export function setAuthUser(user: AppUser | null): void {
  currentUser = user;
}

export function getAuthUser(): AppUser | null {
  return currentUser;
}

export function getAuthUserId(): string | null {
  return currentUser?.id ?? null;
}
