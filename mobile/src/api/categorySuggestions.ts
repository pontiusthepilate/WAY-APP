import { api } from "./client";

export function suggestCategory(profileId: string, text: string) {
  return api.post<{ id: string; text: string; status: string }>("/category-suggestions", { profileId, text });
}
