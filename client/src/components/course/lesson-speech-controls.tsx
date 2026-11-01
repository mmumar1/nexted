import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lessonMarkdownToSpeechText, splitSpeechText } from "@/lib/lesson-speech";

type PlaybackStatus = "idle" | "playing" | "paused" | "finished" | "error";

function getPreferredEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const englishVoices = voices.filter((voice) => /^en(?:-|$)/i.test(voice.lang));
  return englishVoices.find((voice) => /^en-NG$/i.test(voice.lang))
    ?? englishVoices.find((voice) => /^en-GB$/i.test(voice.lang))
    ?? englishVoices.find((voice) => /^en-US$/i.test(voice.lang))
    ?? englishVoices[0];
}

export function LessonSpeechControls({ source }: { source: string }) {
  const speechText = useMemo(() => lessonMarkdownToSpeechText(source), [source]);
  const chunks = useMemo(() => splitSpeechText(speechText), [speechText]);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [currentChunk, setCurrentChunk] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const runId = useRef(0);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      const englishVoices = availableVoices.filter((voice) => /^en(?:-|$)/i.test(voice.lang));
      setVoices(englishVoices);
      setSelectedVoiceURI((current) => current || getPreferredEnglishVoice(englishVoices)?.voiceURI || "");
    };
    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
  }, [supported]);

  useEffect(() => {
    runId.current += 1;
    if (supported) window.speechSynthesis.cancel();
    setCurrentChunk(0);
    setStatus("idle");
    setErrorMessage("");
  }, [speechText, supported]);

  useEffect(() => () => {
    runId.current += 1;
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const speakChunk = (index: number, activeRun: number) => {
    if (activeRun !== runId.current) return;
    if (index >= chunks.length) {
      setStatus("finished");
      setCurrentChunk(chunks.length);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceURI)
      ?? getPreferredEnglishVoice(voices);
    utterance.lang = selectedVoice?.lang ?? "en-NG";
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onstart = () => {
      if (activeRun !== runId.current) return;
      setCurrentChunk(index);
      setStatus("playing");
      setErrorMessage("");
    };
    utterance.onend = () => speakChunk(index + 1, activeRun);
    utterance.onerror = (event) => {
      if (activeRun !== runId.current || event.error === "canceled" || event.error === "interrupted") return;
      setStatus("error");
      setErrorMessage(`Speech playback stopped: ${event.error}. Try another English voice or restart playback.`);
    };
    window.speechSynthesis.speak(utterance);
  };

  const startPlayback = () => {
    if (!supported || chunks.length === 0) return;
    runId.current += 1;
    const activeRun = runId.current;
    window.speechSynthesis.cancel();
    setCurrentChunk(0);
    setStatus("playing");
    setErrorMessage("");
    speakChunk(0, activeRun);
  };

  const pausePlayback = () => {
    if (!supported || status !== "playing") return;
    window.speechSynthesis.pause();
    setStatus("paused");
  };

  const resumePlayback = () => {
    if (!supported || status !== "paused") return;
    window.speechSynthesis.resume();
    setStatus("playing");
  };

  const stopPlayback = () => {
    if (!supported) return;
    runId.current += 1;
    window.speechSynthesis.cancel();
    setCurrentChunk(0);
    setStatus("idle");
    setErrorMessage("");
  };

  if (!supported) {
    return (
      <div className="mb-5 rounded-lg border p-4 text-sm text-muted-foreground" role="status">
        English audio narration is not supported by this browser.
      </div>
    );
  }

  return (
    <section className="mb-5 space-y-3 rounded-lg border bg-muted/20 p-4" aria-label="English lesson audio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Listen to this lesson</h3>
          <Badge variant="secondary">Beta</Badge>
        </div>
        {voices.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            English voice
            <select
              className="h-9 max-w-48 rounded-md border bg-background px-2 text-sm text-foreground"
              value={selectedVoiceURI}
              onChange={(event) => setSelectedVoiceURI(event.target.value)}
              disabled={status === "playing" || status === "paused"}
            >
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {status === "playing" ? (
          <Button type="button" size="sm" variant="outline" onClick={pausePlayback}>
            <Pause className="mr-2 h-4 w-4" />Pause
          </Button>
        ) : status === "paused" ? (
          <Button type="button" size="sm" onClick={resumePlayback}>
            <Play className="mr-2 h-4 w-4" />Resume
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={startPlayback} disabled={!chunks.length}>
            {status === "finished" || status === "error" ? <RotateCcw className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {status === "finished" || status === "error" ? "Play again" : "Play"}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={stopPlayback} disabled={status === "idle"}>
          <Square className="mr-2 h-4 w-4" />Stop
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {status === "playing" && `Playing section ${currentChunk + 1} of ${chunks.length}`}
          {status === "paused" && "Audio paused"}
          {status === "finished" && "Lesson audio finished"}
          {status === "idle" && (chunks.length ? "English speech uses voices available on this device." : "No readable lesson text to play.")}
        </span>
      </div>

      {chunks.length > 0 && (
        <progress
          className="h-2 w-full accent-primary"
          value={status === "finished" ? chunks.length : currentChunk}
          max={chunks.length}
          aria-label="Lesson audio progress"
        />
      )}
      {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
    </section>
  );
}
