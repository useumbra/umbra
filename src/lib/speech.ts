"use client";

export type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

export type SpeechRecognitionLike = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const recognitionConstructor = (): SpeechRecognitionConstructor | undefined => {
  if (typeof window === "undefined") return undefined;
  const value = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return value.SpeechRecognition ?? value.webkitSpeechRecognition;
};

export const dictationSupported = (): boolean =>
  recognitionConstructor() !== undefined;

export const createDictation = (
  onTranscript: (text: string, final: boolean) => void,
  onEnd: () => void,
): SpeechRecognitionLike | undefined => {
  const Constructor = recognitionConstructor();
  if (!Constructor) return undefined;
  const recognition = new Constructor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = navigator.language;
  recognition.onresult = (event) => {
    for (
      let index = event.resultIndex;
      index < event.results.length;
      index += 1
    )
      onTranscript(
        event.results[index][0].transcript,
        event.results[index].isFinal,
      );
  };
  recognition.onend = onEnd;
  return recognition;
};

export const speechSupported = (): boolean =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

export const speak = (text: string): void => {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
};

export const stopSpeaking = (): void => {
  if (speechSupported()) window.speechSynthesis.cancel();
};
