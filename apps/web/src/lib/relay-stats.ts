// Reading a live connection's WebRTC stats: which route it took, and how relay time is shown.
type Stat = Record<string, unknown>;

/** The route the connection is using right now. */
export function selectedPair(stats: Stat[]): Stat | undefined {
  const transport = stats.find((x) => x.type === "transport" && x.selectedCandidatePairId);
  if (transport) return stats.find((x) => x.id === transport.selectedCandidatePairId);
  return stats.find((x) => x.type === "candidate-pair" && (x.nominated || x.selected) && x.state === "succeeded");
}

/** True if the video goes through the relay from either end: this device's, or the PC's. */
export function relayInUse(stats: Stat[]): boolean {
  const pair = selectedPair(stats);
  if (!pair) return false;
  return [pair.localCandidateId, pair.remoteCandidateId].some((id) => stats.find((x) => x.id === id)?.candidateType === "relay");
}

/** "12 min of 200 hours" under an hour, so a short session doesn't show as 0. */
export const relayUsedLabel = (minutes: number) => `${minutes < 60 ? `${minutes} min` : (minutes / 60).toFixed(1)} of 200 hours`;
