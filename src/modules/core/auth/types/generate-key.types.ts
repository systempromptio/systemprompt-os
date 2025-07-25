/**
 * Options for generating JWT key pairs.
 */
export interface IGenerateKeyOptions {
    type: 'jwt';
    algorithm: 'RS256' | 'RS512' | 'ES256' | 'ES512';
    outputDir: string;
    format: 'pem' | 'jwk';
}
