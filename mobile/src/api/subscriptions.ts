import { api } from "./client";

export interface PodcastPlan {
  amount: number; // minor units (kobo)
  currency: string;
  interval: string;
}

export interface PodcastStatus {
  activeSlots: number;
  usedSlots: number;
}

export function getPodcastPlan() {
  return api.get<PodcastPlan>("/subscriptions/podcast/plan");
}

export function getPodcastStatus() {
  return api.get<PodcastStatus>("/subscriptions/podcast/status");
}

export function initializePodcastSubscription() {
  return api.post<{ authorizationUrl: string; reference: string }>("/subscriptions/podcast/initialize");
}

export function verifyPodcastSubscription(reference: string) {
  return api.post<{ status: string; error?: string }>("/subscriptions/podcast/verify", { reference });
}
