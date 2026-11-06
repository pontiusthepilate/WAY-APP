import { File, UploadType } from "expo-file-system";
import { getToken } from "./client";
import { API_BASE_URL } from "./config";

// Overloaded so existing image/video call sites keep their narrower
// return type (mediaType can never actually come back "document" there)
// without needing a cast at every one of those call sites.
export async function uploadMedia(input: { uri: string; type: "image" | "video" }): Promise<{ url: string; mediaType: "image" | "video" }>;
export async function uploadMedia(input: { uri: string; type: "document" }): Promise<{ url: string; mediaType: "document" }>;
// Episode audio (profile-kind feature phase 4) comes from
// expo-document-picker, which already reports the file's real mime type —
// pass it through as `mimeType` instead of guessing from the extension like
// the image/video cases below do.
export async function uploadMedia(input: { uri: string; type: "audio"; mimeType?: string }): Promise<{ url: string; mediaType: "audio" }>;
export async function uploadMedia(
  input: { uri: string; type: "image" | "video" | "document" | "audio"; mimeType?: string }
): Promise<{ url: string; mediaType: "image" | "video" | "document" | "audio" }> {
  const token = await getToken();
  const ext = input.uri.split(".").pop()?.toLowerCase() || (input.type === "image" ? "jpg" : input.type === "video" ? "mp4" : input.type === "audio" ? "mp3" : "pdf");
  const mime =
    input.type === "audio"
      ? input.mimeType ?? (ext === "m4a" ? "audio/mp4" : ext === "wav" ? "audio/wav" : ext === "aac" ? "audio/aac" : "audio/mpeg")
      : input.type === "image"
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
