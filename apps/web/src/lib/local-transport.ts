import type { ChatTransport, UIMessage } from "ai";
import { claudeCodeStream } from "./claude-code";
import { homeChatStream } from "./home-pc";

/** Models that don't go through the server: your home PC's models and Claude Code on this PC. */
export function routeLocal(net: ChatTransport<UIMessage>, body: () => unknown): ChatTransport<UIMessage> {
  return {
    sendMessages: (o) => {
      const b = body() as { connection?: { providerId?: string }; modelId?: string; thinking?: string } | undefined;
      const provider = b?.connection?.providerId;
      if (provider === "home-pc") return Promise.resolve(homeChatStream(b?.modelId ?? "", o.messages, o.abortSignal, o.chatId, b?.thinking));
      if (provider === "claude-code") return Promise.resolve(claudeCodeStream(b?.modelId ?? "", o.messages, o.chatId, o.abortSignal, b?.thinking));
      return net.sendMessages(o);
    },
    reconnectToStream: (o) => net.reconnectToStream(o),
  };
}
