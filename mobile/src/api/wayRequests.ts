import { api } from "./client";

export function sendWayRequest(input: {
  fromProfileId: string;
  toWayId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}) {
  return api.post("/way-requests", input);
}
