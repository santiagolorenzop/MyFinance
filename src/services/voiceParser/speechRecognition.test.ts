import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSpeechListenSession,
  isSpeechRecognitionSupported,
} from '@/services/voiceParser'

type SpeechWindow = Window & {
  SpeechRecognition?: unknown
  webkitSpeechRecognition?: unknown
}

describe('speechRecognition helpers', () => {
  const speechWindow = window as SpeechWindow
  let originalSpeech: unknown
  let originalWebkit: unknown

  afterEach(() => {
    speechWindow.SpeechRecognition = originalSpeech
    speechWindow.webkitSpeechRecognition = originalWebkit
  })

  it('reports unsupported when constructors are missing', () => {
    originalSpeech = speechWindow.SpeechRecognition
    originalWebkit = speechWindow.webkitSpeechRecognition
    speechWindow.SpeechRecognition = undefined
    speechWindow.webkitSpeechRecognition = undefined

    expect(isSpeechRecognitionSupported()).toBe(false)
    expect(createSpeechListenSession({ onFinal: () => undefined })).toBeNull()
  })

  it('creates a session when SpeechRecognition exists', () => {
    originalSpeech = speechWindow.SpeechRecognition
    originalWebkit = speechWindow.webkitSpeechRecognition

    const start = vi.fn()
    const stop = vi.fn()
    const abort = vi.fn()

    class FakeRecognition {
      lang = ''
      interimResults = false
      continuous = false
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start = start
      stop = stop
      abort = abort
    }

    speechWindow.SpeechRecognition = FakeRecognition
    speechWindow.webkitSpeechRecognition = undefined

    const session = createSpeechListenSession({
      onFinal: () => undefined,
      lang: 'en-US',
    })
    expect(session).not.toBeNull()
    session?.start()
    expect(start).toHaveBeenCalled()
  })
})
