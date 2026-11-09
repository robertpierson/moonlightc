import { describe, expect, it } from "vitest";
import { videoSpeed } from "./relay-stats";
import { fastStart } from "./remote";

describe("fastStart", () => {
  const sdp = [
    "m=video 9 UDP/TLS/RTP/SAVPF 96 102",
    "a=rtpmap:96 VP8/90000",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
    "a=rtpmap:111 opus/48000/2",
    "a=fmtp:111 minptime=10;useinbandfec=1",
    "",
  ].join("\r\n");
  it("asks for a quick start on video codecs only, once", () => {
    const out = fastStart(sdp)!;
    expect(out).toContain("profile-level-id=42e01f;x-google-start-bitrate=6000\r\n");
    expect(out).toContain("a=fmtp:111 minptime=10;useinbandfec=1\r\n");
    expect(fastStart(out)).toBe(out);
  });
  it("leaves a missing description alone", () => expect(fastStart(undefined)).toBeUndefined());
});

describe("videoSpeed", () => {
  const read = (t: number, bytes: number, decode: number, decoded: number, jitter: number, emitted: number) => [
    { type: "inbound-rtp", kind: "video", timestamp: t, bytesReceived: bytes, totalDecodeTime: decode, framesDecoded: decoded, jitterBufferDelay: jitter, jitterBufferEmittedCount: emitted, framesPerSecond: 59.6, frameWidth: 1920, frameHeight: 1080, powerEfficientDecoder: true },
    { type: "transport", selectedCandidatePairId: "p" },
    { id: "p", type: "candidate-pair", currentRoundTripTime: 0.012, localCandidateId: "l", remoteCandidateId: "r" },
    { id: "l", candidateType: "host" },
    { id: "r", candidateType: "srflx" },
  ];
  it("works out rate, per-frame times and the total delay from two readings", () => {
    const s = videoSpeed(read(2000, 2_500_000, 0.6, 120, 1.2, 120), read(1000, 0, 0, 60, 0.6, 60));
    expect(s).toMatchObject({ fps: 60, w: 1920, h: 1080, mbps: 20, decodeMs: 10, bufferMs: 10, rttMs: 12, hwDecode: true, relay: false, delayMs: 26 });
  });
  it("has no rates from a single reading", () => {
    const s = videoSpeed(read(1000, 10, 0, 0, 0, 0));
    expect(s.mbps).toBeUndefined();
    expect(s.delayMs).toBeUndefined();
  });
});
