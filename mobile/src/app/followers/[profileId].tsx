import React from "react";
import { useLocalSearchParams } from "expo-router";
import { FollowListScreen } from "../../components/FollowListScreen";

export default function FollowersScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  return <FollowListScreen profileId={profileId} mode="followers" />;
}
