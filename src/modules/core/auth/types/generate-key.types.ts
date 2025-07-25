/**
 * Options for generating JWT key pairs.
 */
export interface IGenerateKeyOptions {
  /** Type of key to generate */
  type: 'jwt';
  /** Algorithm to use for key generation */
  algorithm: 'RS256' | 'RS512' | 'ES256' | 'ES512';
  /** Output directory for generated keys */
  outputDir: string;
  /** Format for the generated keys */
  format: 'pem' | 'jwk';
}