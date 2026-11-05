import { File, UploadType } from "expo-file-system";
import { getToken } from "./client";
import { API_BASE_URL } from "./config";

// Overloaded so existing image/video call sites keep their narrower
// return type (mediaType can never actually come back "document" there)
// without needing a cast at every one of those call sites.
export async function uploadMedia(input: { uri: string; type: "image" | "video" }): Promise<{ url: string; mediaType: "image" | "video" }>;
export async function uploadMedia(input: { uri: string; type: "document" }): Promise<{ url: string; mediaType: "document" }>;
export async function uploadMedia(
  input: { uri: string; type: "image" | "video" | "document" }
): Promise<{ url: string; mediaType: "image" | "video" | "document" }> {
  const token = await getToken();
  const ext = input.uri.split(".").pop()?.toLowerCase() || (input.type === "image" ? "jpg" : input.type === "video" ? "mp4" : "pdf");
  const mime =
    input.type === "image"
      ? `image/${ext === "jpg" ? "jpeg" : ext}`
      : input.type === "video"
        ? `video/${ext === "mov" ? "quicktime" : "mp4"}`
        : "application/pdf";

  // RN's fetch no longer accepts the classic {uri, name, type} magic shape in
  // a FormData field (throws "Unsupported FormDataPart implementation") —
  // expo-file-system's native upload task reads the local file directly instead.
  const file = new File(input.uri);
  const result = await file.upload(`${API_BASE_URL}/uploads`, {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType: mime,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (result.status < 200 || result.status >= 300) {
    const body = JSON.parse(result.body || "{}");
    throw new Error(body?.error ?? "Upload failed");
  }
  return JSON.parse(result.body);
}
