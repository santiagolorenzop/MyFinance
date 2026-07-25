/**
 * Optional Web Speech API helpers. Feature-detected only — never required.
 * Keyboard/OS dictation remains the primary voice path.
 */

export type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }>
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() != null
}

export interface SpeechListenHandlers {
  onFinal: (transcript: string) => void
  onError?: (error: string) => void
  onEnd?: () => void
  lang?: string
}

export interface SpeechListenSession {
  start: () => void
  stop: () => void
  abort: () => void
}

/**
 * Create a one-shot speech recognition session when supported.
 * Returns null when the browser cannot provide Web Speech.
 */
export function createSpeechListenSession(
  handlers: SpeechListenHandlers,
): SpeechListenSession | null {
  const Ctor = getSpeechRecognitionConstructor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = handlers.lang ?? 'en-US'
  recognition.interimResults = false
  recognition.continuous = false

  recognition.onresult = (event) => {
    const first = event.results[0]
    const transcript = first?.[0]?.transcript?.trim()
    if (transcript) handlers.onFinal(transcript)
  }
  recognition.onerror = (event) => {
    handlers.onError?.(event.error)
  }
  recognition.onend = () => {
    handlers.onEnd?.()
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  }
}
