export type {
  VoiceParseAccountAlias,
  VoiceParseContext,
  VoiceParseCurrencyAlias,
  VoiceParseFieldConfidence,
  VoiceParseResult,
  VoiceParser,
} from '@/services/voiceParser/types'
export { voiceParseRequiresConfirmation } from '@/services/voiceParser/types'
export {
  DeterministicVoiceParser,
  deterministicVoiceParser,
} from '@/services/voiceParser/deterministicVoiceParser'
export {
  createSpeechListenSession,
  isSpeechRecognitionSupported,
  type SpeechListenHandlers,
  type SpeechListenSession,
} from '@/services/voiceParser/speechRecognition'

import { deterministicVoiceParser } from '@/services/voiceParser/deterministicVoiceParser'
import type { VoiceParser } from '@/services/voiceParser/types'

/** Active parser — swap implementation without changing call sites. */
export function getVoiceParser(): VoiceParser {
  return deterministicVoiceParser
}
