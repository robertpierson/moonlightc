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

export type Speed = {
  fps?: number;
  w?: number;
  h?: number;
  mbps?: number;
  decodeMs?: number;
  bufferMs?: number;
  rttMs?: number;
  /** Decoded by this device's video chip (not its processor). */
  hwDecode?: boolean;
  relay: boolean;
  /** Network one way + waiting to be shown + decoding: roughly how late the picture is (the PC's encoding adds a few ms). */
  delayMs?: number;
};

/** The viewer's live-video numbers, from two stats readings (rates and averages need the difference between them). */
export function videoSpeed(now: Stat[], before?: Stat[]): Speed {
  const inV = (s?: Stat[]) => s?.find((x) => x.type === "inbound-rtp" && x.kind === "video");
  const v = inV(now);
  const p = inV(before);
  const num = (x: unknown) => (typeof x === "number" ? x : undefined);
  const delta = (k: string) => {
    const a = num(v?.[k]);
    const b = num(p?.[k]);
    return a !== undefined && b !== undefined ? a - b : undefined;
  };
  const per = (total: string, count: string) => {
    const t = delta(total);
    const c = delta(count);
    return t !== undefined && c ? Math.round((t / c) * 10000) / 10 : undefined;
  };
  const dBytes = delta("bytesReceived");
  const dt = delta("timestamp");
  const rtt = num(selectedPair(now)?.currentRoundTripTime);
  const s: Speed = {
    fps: num(v?.framesPerSecond) !== undefined ? Math.round(num(v?.framesPerSecond)!) : undefined,
    w: num(v?.frameWidth),
    h: num(v?.frameHeight),
    mbps: dBytes !== undefined && dt ? Math.round(((dBytes * 8) / (dt / 1000) / 1e6) * 10) / 10 : undefined,
    decodeMs: per("totalDecodeTime", "framesDecoded"),
    bufferMs: per("jitterBufferDelay", "jitterBufferEmittedCount"),
    rttMs: rtt !== undefined ? Math.round(rtt * 1000) : undefined,
    hwDecode: typeof v?.powerEfficientDecoder === "boolean" ? v.powerEfficientDecoder : undefined,
    relay: relayInUse(now),
  };
  if (s.rttMs !== undefined && s.decodeMs !== undefined && s.bufferMs !== undefined) s.delayMs = Math.round(s.rttMs / 2 + s.bufferMs + s.decodeMs);
  return s;
}

/** "12 min of 200 hours" under an hour, so a short session doesn't show as 0. */
export const relayUsedLabel = (minutes: number) => `${minutes < 60 ? `${minutes} min` : (minutes / 60).toFixed(1)} of 200 hours`;
