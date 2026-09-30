import { getToken } from "./client";
import { API_BASE_URL } from "./config";

export async function uploadMedia(input: { uri: string; type: "image" | "video" }): Promise<{ url: string; mediaType: "image" | "video" }> {
  const token = await getToken();
  const ext = input.uri.split(".").pop()?.toLowerCase() || (input.type === "image" ? "jpg" : "mp4");
  const mime = input.type === "image" ? `image/${ext === "jpg" ? "jpeg" : ext}` : `video/${ext === "mov" ? "quicktime" : "mp4"}`;

  const form = new FormData();
  // React Native's fetch accepts this {uri, name, type} shape for file fields.
  form.append("file", { uri: input.uri, name: `upload.${ext}`, type: mime } as unknown as Blob);

  const res = await fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Do not set Content-Type — fetch must generate the multipart boundary itself.
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Upload failed");
  }
  return res.json();
}
