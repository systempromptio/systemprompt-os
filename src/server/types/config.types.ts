/**
 * Server configuration interface.
 */
export interface IServerConfig {
    PORT: string;
  BASEURL: string;
  NODEENV: string;
  SERVERNAME: string;
  SERVERVERSION: string;

    JWTISSUER: string;
  JWTAUDIENCE: string;
  ACCESSTOKEN_EXPIRY: string;
  REFRESHTOKEN_EXPIRY: string;
  AUTHORIZATIONCODE_EXPIRY: string;

    CONFIGPATH: string;
  STATEDIR: string;

    LOGLEVEL: string;
  LOGMAX_SIZE: string;
  LOGMAX_FILES: number;
}
