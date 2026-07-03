// Multi-audio HLS streaming assets for a movie (content item).
// Mirrors the backend `serializeState` payload from /v1/content/:id/streaming-assets.

export type StreamingLanguage = 'uz' | 'ru' | 'en'

export type StreamingStatus = 'uploaded' | 'processing' | 'ready' | 'failed'

export interface StreamingAudioTrack {
  languageCode: string
  label: string
  isDefault: boolean
  url: string | null
}

export interface StreamingSubtitleTrack {
  languageCode: string
  label: string
  url: string | null
}

export interface StreamingState {
  streamingStatus: StreamingStatus | null
  hlsUrl: string | null
  defaultAudioLanguage: string | null
  durationSeconds: number | null
  processingError: string | null
  audioTracks: StreamingAudioTrack[]
  subtitles: StreamingSubtitleTrack[]
}

// One row in the upload form: a language-scoped file slot (audio or subtitle).
export interface StreamingUploadSlot {
  field: string
  language: StreamingLanguage
  label: string
  accept: string
}
