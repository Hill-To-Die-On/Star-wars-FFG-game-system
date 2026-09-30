// Shared by the public data validators: published data holds references and
// labels only, never private file paths or source documents.
export const PRIVATE_PATH = /(?:[a-z]:[\\/]|(?:^|[\\/])\.\.(?:[\\/]|$)|\.(?:xml|pdf)\b)/i;
export const PRINTED_PAGE = /^\d+(?:[-–]\d+)?$/;
