import { api } from "./client";
import type { ProfileSummary } from "../types";

export type BlockType = "block" | "mute";
export type ReportTargetType = "profile" | "post" | "comment";

export interface Block {
  id: string;
  actorProfileId: string;
  targetProfileId: string;
  type: BlockType;
  createdAt: string;
  targetProfile: ProfileSummary | null;
}

export function createBlock(profileId: string, targetProfileId: string, type: BlockType) {
  return api.post<{ id: string }>("/blocks", { profileId, targetProfileId, type });
}

export function getMyBlocks(profileId: string, type: BlockType) {
  return api.get<Block[]>(`/blocks/mine?profileId=${encodeURIComponent(profileId)}&type=${type}`);
}

export function removeBlock(profileId: string, targetProfileId: string, type: BlockType) {
  return api.del(`/blocks/${targetProfileId}?profileId=${encodeURIComponent(profileId)}&type=${type}`);
}

export function createReport(profileId: string, targetType: ReportTargetType, targetId: string, reason: string) {
  return api.post<{ id: string }>("/reports", { profileId, targetType, targetId, reason });
}
