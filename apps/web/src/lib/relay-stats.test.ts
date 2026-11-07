import { describe, expect, it } from "vitest";
import { relayInUse, relayUsedLabel, selectedPair } from "./relay-stats";

const stats = (local: string, remote: string, otherNominatedFirst = false) => [
  ...(otherNominatedFirst ? [{ id: "old", type: "candidate-pair", nominated: true, state: "succeeded", localCandidateId: "h", remoteCandidateId: "h2" }] : []),
  { id: "t", type: "transport", selectedCandidatePairId: "p" },
  { id: "p", type: "candidate-pair", nominated: true, state: "succeeded", localCandidateId: "l", remoteCandidateId: "r" },
  { id: "l", type: "local-candidate", candidateType: local },
  { id: "r", type: "remote-candidate", candidateType: remote },
  { id: "h", type: "local-candidate", candidateType: "host" },
  { id: "h2", type: "remote-candidate", candidateType: "host" },
];

describe("relayInUse", () => {
  it("counts the relay on this device's end", () => expect(relayInUse(stats("relay", "srflx"))).toBe(true));
  it("counts the relay on the PC's end", () => expect(relayInUse(stats("prflx", "relay"))).toBe(true));
  it("a direct connection isn't the relay", () => expect(relayInUse(stats("srflx", "srflx"))).toBe(false));
  it("uses the route in use, not an older one", () => {
    expect(selectedPair(stats("relay", "relay", true))?.id).toBe("p");
    expect(relayInUse(stats("relay", "relay", true))).toBe(true);
  });
  it("no connection yet", () => expect(relayInUse([])).toBe(false));
});

describe("relayUsedLabel", () => {
  it("shows minutes under an hour", () => {
    expect(relayUsedLabel(0)).toBe("0 min of 200 hours");
    expect(relayUsedLabel(25)).toBe("25 min of 200 hours");
  });
  it("shows hours after that", () => expect(relayUsedLabel(90)).toBe("1.5 of 200 hours"));
});
