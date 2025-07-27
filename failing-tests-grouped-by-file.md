# Failing Tests Report - Grouped by File

Total failing tests: 169
Total files with failing tests: 12

## Batch 1 (Files 1-12)

### tests/e2e/02-server-auth.e2e.spec.ts (12 tests)

1. [02] Server Auth Domain > OAuth2 Authorization Flow > should reject authorization request without client_id
2. [02] Server Auth Domain > OAuth2 Authorization Flow > should reject authorization request without response_type
3. [02] Server Auth Domain > OAuth2 Authorization Flow > should reject unsupported response_type
4. [02] Server Auth Domain > OAuth2 Authorization Flow > should show IDP selection for valid authorization request
5. [02] Server Auth Domain > OAuth2 Authorization Flow > should handle IDP selection and redirect
6. [02] Server Auth Domain > OAuth2 Token Endpoint > should reject token request without grant_type
7. [02] Server Auth Domain > OAuth2 Token Endpoint > should reject unsupported grant_type
8. [02] Server Auth Domain > OAuth2 Token Endpoint > should reject invalid authorization code
9. [02] Server Auth Domain > OAuth2 Token Endpoint > should handle refresh_token grant type
10. [02] Server Auth Domain > Authorization Callback > should handle OAuth callback with error
11. [02] Server Auth Domain > Authorization Callback > should validate state parameter in callback
12. [02] Server Auth Domain > Security Headers > should include security headers on auth endpoints

### tests/e2e/mcp-tool-api.spec.ts (7 tests)

1. MCP Tool API E2E Tests > Tool Listing Flow > should show different tools based on user role
2. MCP Tool API E2E Tests > Tool Execution Flow > should enforce permissions throughout tool execution
3. MCP Tool API E2E Tests > Tool Execution Flow > should handle tool errors gracefully
4. MCP Tool API E2E Tests > Audit Trail > should create comprehensive audit logs
5. MCP Tool API E2E Tests > Performance > should handle concurrent requests efficiently
6. MCP Tool API E2E Tests > Integration with Permission System > should respect custom permissions
7. MCP Tool API E2E Tests > Error Recovery > should handle and log various error conditions

### tests/e2e/mcp-tool-permissions.spec.ts (13 tests)

1. MCP Tool Permissions E2E > Tool Listing > should return check-status tool for admin session
2. MCP Tool Permissions E2E > Tool Listing > should return empty tool list for basic session
3. MCP Tool Permissions E2E > Tool Listing > should return empty tool list without session
4. MCP Tool Permissions E2E > Tool Execution > should allow admin to execute check-status tool
5. MCP Tool Permissions E2E > Tool Execution > should deny basic user from executing check-status tool
6. MCP Tool Permissions E2E > Tool Execution > should return error for unknown tool
7. MCP Tool Permissions E2E > Tool Execution > should require session for tool execution
8. MCP Tool Permissions E2E > Tool Arguments > should accept valid arguments for check-status
9. MCP Tool Permissions E2E > Tool Arguments > should handle invalid argument types
10. MCP Tool Permissions E2E > Security Headers > should not expose internal metadata in tool list
11. MCP Tool Permissions E2E > Rate Limiting > should handle multiple rapid requests
12. MCP Tool Permissions E2E > Error Handling > should handle malformed JSON-RPC requests
13. MCP Tool Permissions E2E > Error Handling > should handle invalid method names

### tests/unit/modules/core/auth/providers/core/oauth2.spec.ts (3 tests)

1. GenericOAuth2Provider > exchangeCodeForTokens > exchanges authorization code for tokens
2. GenericOAuth2Provider > getUserInfo > fetches user info with access token
3. GenericOAuth2Provider > refreshAccessToken > refreshes access token using refresh token

### tests/unit/server/external/auth/providers/generic-oauth2.spec.ts (36 tests)

1. GenericOAuth2Provider > Constructor > should initialize OAuth2 provider with correct properties
2. GenericOAuth2Provider > Constructor > should set default scope when not provided
3. GenericOAuth2Provider > Constructor > should set default scope when scope is null
4. GenericOAuth2Provider > Constructor > should set default scope when scope is undefined
5. GenericOAuth2Provider > getAuthorizationUrl > should include nonce for OIDC provider when provided
6. GenericOAuth2Provider > exchangeCodeForToken > should successfully exchange code for tokens
7. GenericOAuth2Provider > exchangeCodeForToken > should handle missing client secret gracefully
8. GenericOAuth2Provider > exchangeCodeForToken > should handle null client secret gracefully
9. GenericOAuth2Provider > exchangeCodeForToken > should throw error when token exchange fails
10. GenericOAuth2Provider > exchangeCodeForToken > should throw error when fetch throws
11. GenericOAuth2Provider > getUserInfo > should successfully retrieve user info with default mapping
12. GenericOAuth2Provider > getUserInfo > should use custom userinfo mapping when provided
13. GenericOAuth2Provider > getUserInfo > should fallback to standard fields when custom mapping returns undefined
14. GenericOAuth2Provider > getUserInfo > should fallback to id field when sub is not available
15. GenericOAuth2Provider > getUserInfo > should return empty string for id when no fallbacks are available
16. GenericOAuth2Provider > getUserInfo > should handle nested object paths in mapping
17. GenericOAuth2Provider > getUserInfo > should handle deep nested paths that do not exist
18. GenericOAuth2Provider > getUserInfo > should handle null values in nested objects
19. GenericOAuth2Provider > getUserInfo > should throw error when userinfo request fails
20. GenericOAuth2Provider > getUserInfo > should throw error when fetch throws
21. GenericOAuth2Provider > refreshTokens > should successfully refresh tokens
22. GenericOAuth2Provider > refreshTokens > should handle missing client secret gracefully
23. GenericOAuth2Provider > refreshTokens > should handle null client secret gracefully
24. GenericOAuth2Provider > refreshTokens > should throw error when token refresh fails
25. GenericOAuth2Provider > refreshTokens > should throw error when fetch throws
26. GenericOAuth2Provider > OIDC-specific functionality > should support OIDC-specific features
27. GenericOAuth2Provider > OIDC-specific functionality > should include nonce in authorization URL for OIDC providers
28. GenericOAuth2Provider > Edge cases and error scenarios > should handle malformed JSON responses in token exchange
29. GenericOAuth2Provider > Edge cases and error scenarios > should handle malformed JSON responses in token refresh
30. GenericOAuth2Provider > Edge cases and error scenarios > should handle malformed JSON responses in getUserInfo
31. GenericOAuth2Provider > getNestedValue functionality > should handle primitive values in nested objects
32. GenericOAuth2Provider > getNestedValue functionality > should handle arrays in nested paths
33. GenericOAuth2Provider > getNestedValue functionality > should return undefined for out-of-bounds array access
34. GenericOAuth2Provider > getNestedValue functionality > should handle empty path segments
35. GenericOAuth2Provider > getNestedValue functionality > should handle paths with multiple dots
36. GenericOAuth2Provider > getNestedValue functionality > should handle circular references gracefully

### tests/unit/server/external/rest/oauth2/authorization-server.spec.ts (15 tests)

1. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should successfully return authorization server metadata
2. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle different metadata configurations
3. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle metadata with minimal required fields only
4. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle metadata with all optional fields populated
5. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should propagate errors from auth module not being loaded
6. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should propagate errors from oauth2ConfigService being undefined
7. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should propagate errors from oauth2ConfigService method failure
8. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle response.json method throwing an error
9. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should validate interface compliance with IOAuth2ServerMetadataInternal
10. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle empty arrays in metadata
11. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should preserve exact metadata structure without modification
12. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should work with different request types
13. AuthorizationServerEndpoint > error boundary coverage > should handle auth module exports being null
14. AuthorizationServerEndpoint > error boundary coverage > should handle auth module exports being undefined
15. AuthorizationServerEndpoint > error boundary coverage > should handle oauth2ConfigService method being undefined

### tests/unit/server/external/rest/oauth2/authorize.spec.ts (13 tests)

1. OAuth2 Authorize Endpoint > getAuthorize > without provider parameter > should display authorization consent form with valid parameters
2. OAuth2 Authorize Endpoint > getAuthorize > without provider parameter > should handle missing required parameters
3. OAuth2 Authorize Endpoint > getAuthorize > without provider parameter > should handle invalid responseType
4. OAuth2 Authorize Endpoint > getAuthorize > with provider parameter > should redirect to Google provider with state
5. OAuth2 Authorize Endpoint > getAuthorize > with provider parameter > should handle case insensitive provider names
6. OAuth2 Authorize Endpoint > getAuthorize > with provider parameter > should handle unknown provider
7. OAuth2 Authorize Endpoint > getAuthorize > error handling > should handle server errors during HTML generation
8. OAuth2 Authorize Endpoint > getAuthorize > error handling > should handle non-Error exceptions
9. OAuth2 Authorize Endpoint > postAuthorize > authorization denial > should handle denial with missing redirectUri
10. OAuth2 Authorize Endpoint > postAuthorize > authorization approval > should handle authorization approval with valid user
11. OAuth2 Authorize Endpoint > postAuthorize > authorization approval > should handle missing user authentication
12. OAuth2 Authorize Endpoint > handleProviderCallback > successful callback handling > should handle provider callback with authorization code
13. OAuth2 Authorize Endpoint > handleProviderCallback > error handling > should handle provider callback error

### tests/unit/server/external/rest/oauth2/default-client.spec.ts (2 tests)

1. getDefaultOAuthClient > should create new default client when none exists
2. getDefaultOAuthClient > should create new client with all required registration fields

### tests/unit/server/external/rest/oauth2/errors.spec.ts (18 tests)

1. OAuth2 Errors > OAuth2ErrorType Enum > should have correct error type values
2. OAuth2 Errors > OAuth2Error Class > should create error with type and description
3. OAuth2 Errors > OAuth2Error Class > should use error type as message when description is not provided
4. OAuth2 Errors > OAuth2Error Class > should accept custom error code
5. OAuth2 Errors > OAuth2Error Class > should include error URI when provided
6. OAuth2 Errors > OAuth2Error Class > toJSON > should serialize to OAuth2ErrorResponse format
7. OAuth2 Errors > OAuth2Error Class > toJSON > should omit undefined fields
8. OAuth2 Errors > OAuth2Error Class > toJSON > should include error_uri when present
9. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create InvalidRequest error
10. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create InvalidClient error with 401 code
11. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create InvalidGrant error
12. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create UnauthorizedClient error
13. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create UnsupportedGrantType error
14. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create UnsupportedResponseType error
15. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create InvalidScope error
16. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create AccessDenied error
17. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create ServerError with 500 code
18. OAuth2 Errors > OAuth2Error Class > should be instanceof Error

### tests/unit/server/external/rest/oauth2/index.spec.ts (3 tests)

1. setupOAuth2Routes > should initialize all endpoint handlers with correct parameters
2. setupOAuth2Routes > should use authMiddleware for protected routes
3. setupOAuth2Routes > should work with different baseUrl formats

### tests/unit/server/external/rest/oauth2/userinfo.spec.ts (32 tests)

1. UserInfoEndpoint > getUserInfo > returns 401 when user is not authenticated
2. UserInfoEndpoint > getUserInfo > returns 400 when user is not found in database
3. UserInfoEndpoint > getUserInfo > returns basic user info with openid scope only
4. UserInfoEndpoint > getUserInfo > handles undefined scope
5. UserInfoEndpoint > getUserInfo > handles empty string scope
6. UserInfoEndpoint > getUserInfo > includes profile information when profile scope is present
7. UserInfoEndpoint > getUserInfo > includes email information when email scope is present
8. UserInfoEndpoint > getUserInfo > includes agent information when agent scope is present
9. UserInfoEndpoint > getUserInfo > includes all information when all scopes are present
10. UserInfoEndpoint > getUserInfo > handles user without name field
11. UserInfoEndpoint > getUserInfo > handles user without avatarUrl field
12. UserInfoEndpoint > getUserInfo > handles email without @ symbol
13. UserInfoEndpoint > getUserInfo > handles email with multiple @ symbols
14. UserInfoEndpoint > getUserInfo > handles multiple scopes separated by spaces
15. UserInfoEndpoint > getUserInfo > handles different user ID
16. UserInfoEndpoint > getUserInfo > ignores unknown scopes
17. UserInfoEndpoint > getUserInfo > only includes scope-specific data in response
18. UserInfoEndpoint > getUserInfo > tests all conditional branches in scope checking
19. UserInfoEndpoint > getUserInfo > verifies AuthRepository singleton is called
20. UserInfoEndpoint > getUserInfo > handles empty email parts correctly
21. UserInfoEndpoint > getUserInfo > tests email_verified is always true
22. UserInfoEndpoint > getUserInfo > tests agent_id generation format
23. UserInfoEndpoint > getUserInfo > ensures profile scope conditional checks work correctly
24. UserInfoEndpoint > getUserInfo > ensures email scope conditional checks work correctly
25. UserInfoEndpoint > getUserInfo > ensures agent scope conditional checks work correctly
26. UserInfoEndpoint > getUserInfo > handles database errors gracefully
27. UserInfoEndpoint > getUserInfo > handles user with empty email string
28. UserInfoEndpoint > getUserInfo > handles user with null name field
29. UserInfoEndpoint > getUserInfo > handles user with null avatarUrl field
30. UserInfoEndpoint > getUserInfo > verifies email_verified undefined check branch
31. UserInfoEndpoint > getUserInfo > handles scope with mixed case
32. UserInfoEndpoint > getUserInfo > handles scope string with trailing/leading spaces

### tests/unit/server/external/rest/oauth2/well-known.spec.ts (15 tests)

1. WellKnownEndpoint > constructor > should create an instance with default publicKeyJWK as null
2. WellKnownEndpoint > getOpenIDConfiguration > should return OpenID configuration from oauth2ConfigService
3. WellKnownEndpoint > getOpenIDConfiguration > should handle when authModule throws an error
4. WellKnownEndpoint > getOpenIDConfiguration > should handle when oauth2ConfigService throws an error
5. WellKnownEndpoint > getOpenIDConfiguration > should handle when getOpenIDConfiguration throws an error
6. WellKnownEndpoint > getOpenIDConfiguration > should work with different request objects
7. WellKnownEndpoint > getOpenIDConfiguration > should handle null/undefined config gracefully
8. WellKnownEndpoint > getJWKS > should return 500 error when publicKeyJWK is null
9. WellKnownEndpoint > OpenIDConfiguration interface > should accept valid OpenIDConfiguration objects
10. WellKnownEndpoint > OpenIDConfiguration interface > should handle minimal OpenIDConfiguration objects
11. WellKnownEndpoint > Edge cases and error scenarios > should handle when response.json throws an error
12. WellKnownEndpoint > Edge cases and error scenarios > should handle when response.status throws an error in getJWKS
13. WellKnownEndpoint > Edge cases and error scenarios > should handle concurrent calls to getOpenIDConfiguration
14. WellKnownEndpoint > Property access and method binding > should maintain method binding when extracted
15. WellKnownEndpoint > Property access and method binding > should handle this context correctly in arrow functions

