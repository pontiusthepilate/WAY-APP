import { api } from "./client";
import type { RemoteCameraRequest, RemoteCameraSession } from "../types";

export function sendCameraRequest(input: { fromProfileId: string; toWayId: string; message?: string }) {
  return api.post<RemoteCameraRequest>("/remote-camera/requests", input);
}

export function getCameraRequest(id: string) {
  return api.get<RemoteCameraRequest>(`/remote-camera/requests/${id}`);
}

export function getIncomingCameraRequests(profileId: string) {
  return api.get<RemoteCameraRequest[]>(`/remote-camera/requests/incoming/${profileId}`);
}

export function getOutgoingCameraRequests(profileId: string) {
  return api.get<RemoteCameraRequest[]>(`/remote-camera/requests/outgoing/${profileId}`);
}

export function acceptCameraRequest(id: string, profileId: string) {
  return api.post<RemoteCameraSession>(`/remote-camera/requests/${id}/accept`, { profileId });
}

export function declineCameraRequest(id: string, profileId: string) {
  return api.post<RemoteCameraRequest>(`/remote-camera/requests/${id}/decline`, { profileId });
}

export function getCameraSession(id: string) {
  return api.get<RemoteCameraSession>(`/remote-camera/sessions/${id}`);
}

export function endCameraSession(id: string, profileId: string) {
  return api.post<RemoteCameraSession>(`/remote-camera/sessions/${id}/end`, { profileId });
}
