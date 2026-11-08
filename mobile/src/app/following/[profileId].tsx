import React from "react";
import { useLocalSearchParams } from "expo-router";
import { FollowListScreen } from "../../components/FollowListScreen";

export default function FollowingScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  return <FollowListScreen profileId={profileId} mode="following" />;
}
