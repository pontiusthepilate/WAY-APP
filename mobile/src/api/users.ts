import { api } from "./client";

export interface Me {
  id: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

export function getMe() {
  return api.get<Me>("/users/me");
}

export function changePhone(identifier: string, code: string) {
  return api.post<Me>("/users/me/change-phone", { identifier, code });
}

export function changeEmail(identifier: string, code: string) {
  return api.post<Me>("/users/me/change-email", { identifier, code });
}

export function deleteAccount() {
  return api.del("/users/me");
}
