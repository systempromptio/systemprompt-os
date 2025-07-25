/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Client registration request as per RFC 7591.
 */
export interface IClientRegistrationRequest {
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  redirect_uris?: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  software_id?: string;
  software_version?: string;
}

/**
 * Client registration response as per RFC 7591.
 */
export interface IClientRegistrationResponse extends IClientRegistrationRequest {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  registration_access_token?: string;
  registration_client_uri?: string;
}