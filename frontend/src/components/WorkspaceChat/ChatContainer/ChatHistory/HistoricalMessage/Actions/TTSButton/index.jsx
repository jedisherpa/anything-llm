import { useTTSProvider } from "@/components/contexts/TTSProvider";
import NativeTTSMessage from "./native";
import AsyncTTSMessage from "./asyncTts";
import PiperTTSMessage from "./piperTTS";

function WrapTTS({ children }) {
  return <div className="mx-2">{children}</div>;
}

function isDesktopTauri() {
  return typeof window !== "undefined" && Boolean(window.__TAURI__);
}

export default function TTSMessage({ slug, chatId, message }) {
  const { settings, provider, loading } = useTTSProvider();
  if (!chatId || loading) return null;

  switch (provider) {
    case "piper_local":
      return (
        <WrapTTS>
          {isDesktopTauri() ? (
            <AsyncTTSMessage chatId={chatId} slug={slug} />
          ) : (
            <PiperTTSMessage
              chatId={chatId}
              message={message}
              voiceId={settings?.TTSPiperTTSVoiceModel}
            />
          )}
        </WrapTTS>
      );
    case "openai":
    case "generic-openai":
    case "elevenlabs":
      return (
        <WrapTTS>
          <AsyncTTSMessage chatId={chatId} slug={slug} />
        </WrapTTS>
      );
    default:
      return (
        <WrapTTS>
          <NativeTTSMessage chatId={chatId} message={message} />
        </WrapTTS>
      );
  }
}
