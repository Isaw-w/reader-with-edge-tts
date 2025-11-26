/**
 * Base exception class for all Edge TTS related errors.
 */
export class EdgeTTSException extends Error { }

/**
 * Exception raised when there's an error adjusting clock skew for API requests.
 */
export class SkewAdjustmentError extends Error { }

/**
 * Exception raised when an unknown response is received from the TTS service.
 */
export class UnknownResponse extends Error { }

/**
 * Exception raised when an unexpected response is received from the TTS service.
 */
export class UnexpectedResponse extends Error { }

/**
 * Exception raised when no audio data is received during synthesis.
 */
export class NoAudioReceived extends Error { }

/**
 * Exception raised when there's an error with the WebSocket connection.
 */
export class WebSocketError extends Error { }

/**
 * Exception raised when an invalid value is provided to a function or method.
 */
export class ValueError extends Error { }
