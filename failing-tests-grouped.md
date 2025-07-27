# Failing Tests Report

Total failing tests: 165

## Batch 1 (Tests 1-20)
1. GenericOAuth2Provider > exchangeCodeForTokens > exchanges authorization code for tokens
2. GenericOAuth2Provider > getUserInfo > fetches user info with access token
3. GenericOAuth2Provider > refreshAccessToken > refreshes access token using refresh token
4. UserInfoEndpoint > getUserInfo > returns 401 when user is not authenticated
5. UserInfoEndpoint > getUserInfo > returns 400 when user is not found in database
6. UserInfoEndpoint > getUserInfo > returns basic user info with openid scope only
7. UserInfoEndpoint > getUserInfo > handles undefined scope
8. UserInfoEndpoint > getUserInfo > handles empty string scope
9. UserInfoEndpoint > getUserInfo > includes profile information when profile scope is present
10. UserInfoEndpoint > getUserInfo > includes email information when email scope is present
11. UserInfoEndpoint > getUserInfo > includes agent information when agent scope is present
12. UserInfoEndpoint > getUserInfo > includes all information when all scopes are present
13. UserInfoEndpoint > getUserInfo > handles user without name field
14. UserInfoEndpoint > getUserInfo > handles user without avatarUrl field
15. UserInfoEndpoint > getUserInfo > handles email without @ symbol
16. UserInfoEndpoint > getUserInfo > handles email with multiple @ symbols
17. UserInfoEndpoint > getUserInfo > handles multiple scopes separated by spaces
18. UserInfoEndpoint > getUserInfo > handles different user ID
19. UserInfoEndpoint > getUserInfo > ignores unknown scopes
20. UserInfoEndpoint > getUserInfo > only includes scope-specific data in response

## Batch 2 (Tests 21-40)
21. UserInfoEndpoint > getUserInfo > tests all conditional branches in scope checking
22. UserInfoEndpoint > getUserInfo > verifies AuthRepository singleton is called
23. UserInfoEndpoint > getUserInfo > handles empty email parts correctly
24. UserInfoEndpoint > getUserInfo > tests email_verified is always true
25. UserInfoEndpoint > getUserInfo > tests agent_id generation format
26. UserInfoEndpoint > getUserInfo > ensures profile scope conditional checks work correctly
27. UserInfoEndpoint > getUserInfo > ensures email scope conditional checks work correctly
28. UserInfoEndpoint > getUserInfo > ensures agent scope conditional checks work correctly
29. UserInfoEndpoint > getUserInfo > handles database errors gracefully
30. UserInfoEndpoint > getUserInfo > handles user with empty email string
31. UserInfoEndpoint > getUserInfo > handles user with null name field
32. UserInfoEndpoint > getUserInfo > handles user with null avatarUrl field
33. UserInfoEndpoint > getUserInfo > verifies email_verified undefined check branch
34. UserInfoEndpoint > getUserInfo > handles scope with mixed case
35. UserInfoEndpoint > getUserInfo > handles scope string with trailing/leading spaces
36. OAuth2 Errors > OAuth2ErrorType Enum > should have correct error type values
37. OAuth2 Errors > OAuth2Error Class > should create error with type and description
38. OAuth2 Errors > OAuth2Error Class > should use error type as message when description is not provided
39. OAuth2 Errors > OAuth2Error Class > should accept custom error code
40. OAuth2 Errors > OAuth2Error Class > should include error URI when provided

## Batch 3 (Tests 41-60)
41. OAuth2 Errors > OAuth2Error Class > toJSON > should serialize to OAuth2ErrorResponse format
42. OAuth2 Errors > OAuth2Error Class > toJSON > should omit undefined fields
43. OAuth2 Errors > OAuth2Error Class > toJSON > should include error_uri when present
44. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create InvalidRequest error
45. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create InvalidClient error with 401 code
46. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create InvalidGrant error
47. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create UnauthorizedClient error
48. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create UnsupportedGrantType error
49. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create UnsupportedResponseType error
50. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create InvalidScope error
51. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create AccessDenied error
52. OAuth2 Errors > OAuth2Error Class > Static factory methods > should create ServerError with 500 code
53. OAuth2 Errors > OAuth2Error Class > should be instanceof Error
54. GenericOAuth2Provider > Constructor > should initialize OAuth2 provider with correct properties
55. GenericOAuth2Provider > Constructor > should set default scope when not provided
56. GenericOAuth2Provider > Constructor > should set default scope when scope is null
57. GenericOAuth2Provider > Constructor > should set default scope when scope is undefined
58. GenericOAuth2Provider > getAuthorizationUrl > should include nonce for OIDC provider when provided
59. GenericOAuth2Provider > exchangeCodeForToken > should successfully exchange code for tokens
60. GenericOAuth2Provider > exchangeCodeForToken > should handle missing client secret gracefully

## Batch 4 (Tests 61-80)
61. GenericOAuth2Provider > exchangeCodeForToken > should handle null client secret gracefully
62. GenericOAuth2Provider > exchangeCodeForToken > should throw error when token exchange fails
63. GenericOAuth2Provider > exchangeCodeForToken > should throw error when fetch throws
64. GenericOAuth2Provider > getUserInfo > should successfully retrieve user info with default mapping
65. GenericOAuth2Provider > getUserInfo > should use custom userinfo mapping when provided
66. GenericOAuth2Provider > getUserInfo > should fallback to standard fields when custom mapping returns undefined
67. GenericOAuth2Provider > getUserInfo > should fallback to id field when sub is not available
68. GenericOAuth2Provider > getUserInfo > should return empty string for id when no fallbacks are available
69. GenericOAuth2Provider > getUserInfo > should handle nested object paths in mapping
70. GenericOAuth2Provider > getUserInfo > should handle deep nested paths that do not exist
71. GenericOAuth2Provider > getUserInfo > should handle null values in nested objects
72. GenericOAuth2Provider > getUserInfo > should throw error when userinfo request fails
73. GenericOAuth2Provider > getUserInfo > should throw error when fetch throws
74. GenericOAuth2Provider > refreshTokens > should successfully refresh tokens
75. GenericOAuth2Provider > refreshTokens > should handle missing client secret gracefully
76. GenericOAuth2Provider > refreshTokens > should handle null client secret gracefully
77. GenericOAuth2Provider > refreshTokens > should throw error when token refresh fails
78. GenericOAuth2Provider > refreshTokens > should throw error when fetch throws
79. GenericOAuth2Provider > OIDC-specific functionality > should support OIDC-specific features
80. GenericOAuth2Provider > OIDC-specific functionality > should include nonce in authorization URL for OIDC providers

## Batch 5 (Tests 81-100)
81. GenericOAuth2Provider > Edge cases and error scenarios > should handle malformed JSON responses in token exchange
82. GenericOAuth2Provider > Edge cases and error scenarios > should handle malformed JSON responses in token refresh
83. GenericOAuth2Provider > Edge cases and error scenarios > should handle malformed JSON responses in getUserInfo
84. GenericOAuth2Provider > getNestedValue functionality > should handle primitive values in nested objects
85. GenericOAuth2Provider > getNestedValue functionality > should handle arrays in nested paths
86. GenericOAuth2Provider > getNestedValue functionality > should return undefined for out-of-bounds array access
87. GenericOAuth2Provider > getNestedValue functionality > should handle empty path segments
88. GenericOAuth2Provider > getNestedValue functionality > should handle paths with multiple dots
89. GenericOAuth2Provider > getNestedValue functionality > should handle circular references gracefully
90. WellKnownEndpoint > constructor > should create an instance with default publicKeyJWK as null
91. WellKnownEndpoint > getOpenIDConfiguration > should return OpenID configuration from oauth2ConfigService
92. WellKnownEndpoint > getOpenIDConfiguration > should handle when authModule throws an error
93. WellKnownEndpoint > getOpenIDConfiguration > should handle when oauth2ConfigService throws an error
94. WellKnownEndpoint > getOpenIDConfiguration > should handle when getOpenIDConfiguration throws an error
95. WellKnownEndpoint > getOpenIDConfiguration > should work with different request objects
96. WellKnownEndpoint > getOpenIDConfiguration > should handle null/undefined config gracefully
97. WellKnownEndpoint > getJWKS > should return 500 error when publicKeyJWK is null
98. WellKnownEndpoint > OpenIDConfiguration interface > should accept valid OpenIDConfiguration objects
99. WellKnownEndpoint > OpenIDConfiguration interface > should handle minimal OpenIDConfiguration objects
100. WellKnownEndpoint > Edge cases and error scenarios > should handle when response.json throws an error

## Batch 6 (Tests 101-120)
101. WellKnownEndpoint > Edge cases and error scenarios > should handle when response.status throws an error in getJWKS
102. WellKnownEndpoint > Edge cases and error scenarios > should handle concurrent calls to getOpenIDConfiguration
103. WellKnownEndpoint > Property access and method binding > should maintain method binding when extracted
104. WellKnownEndpoint > Property access and method binding > should handle this context correctly in arrow functions
105. OAuth2 Authorize Endpoint > getAuthorize > without provider parameter > should display authorization consent form with valid parameters
106. OAuth2 Authorize Endpoint > getAuthorize > without provider parameter > should handle missing required parameters
107. OAuth2 Authorize Endpoint > getAuthorize > without provider parameter > should handle invalid responseType
108. OAuth2 Authorize Endpoint > getAuthorize > with provider parameter > should redirect to Google provider with state
109. OAuth2 Authorize Endpoint > getAuthorize > with provider parameter > should handle case insensitive provider names
110. OAuth2 Authorize Endpoint > getAuthorize > with provider parameter > should handle unknown provider
111. OAuth2 Authorize Endpoint > getAuthorize > error handling > should handle server errors during HTML generation
112. OAuth2 Authorize Endpoint > getAuthorize > error handling > should handle non-Error exceptions
113. OAuth2 Authorize Endpoint > postAuthorize > authorization denial > should handle denial with missing redirectUri
114. OAuth2 Authorize Endpoint > postAuthorize > authorization approval > should handle authorization approval with valid user
115. OAuth2 Authorize Endpoint > postAuthorize > authorization approval > should handle missing user authentication
116. OAuth2 Authorize Endpoint > handleProviderCallback > successful callback handling > should handle provider callback with authorization code
117. OAuth2 Authorize Endpoint > handleProviderCallback > error handling > should handle provider callback error
118. [02] Server Auth Domain > OAuth2 Authorization Flow > should reject authorization request without client_id
119. [02] Server Auth Domain > OAuth2 Authorization Flow > should reject authorization request without response_type
120. [02] Server Auth Domain > OAuth2 Authorization Flow > should reject unsupported response_type

## Batch 7 (Tests 121-140)
121. [02] Server Auth Domain > OAuth2 Authorization Flow > should show IDP selection for valid authorization request
122. [02] Server Auth Domain > OAuth2 Authorization Flow > should handle IDP selection and redirect
123. [02] Server Auth Domain > OAuth2 Token Endpoint > should reject token request without grant_type
124. [02] Server Auth Domain > OAuth2 Token Endpoint > should reject unsupported grant_type
125. [02] Server Auth Domain > OAuth2 Token Endpoint > should reject invalid authorization code
126. [02] Server Auth Domain > OAuth2 Token Endpoint > should handle refresh_token grant type
127. [02] Server Auth Domain > Authorization Callback > should handle OAuth callback with error
128. [02] Server Auth Domain > Authorization Callback > should validate state parameter in callback
129. [02] Server Auth Domain > Security Headers > should include security headers on auth endpoints
130. MCP Tool API E2E Tests > Tool Listing Flow > should show different tools based on user role
131. MCP Tool API E2E Tests > Tool Execution Flow > should enforce permissions throughout tool execution
132. MCP Tool API E2E Tests > Tool Execution Flow > should handle tool errors gracefully
133. MCP Tool API E2E Tests > Audit Trail > should create comprehensive audit logs
134. MCP Tool API E2E Tests > Performance > should handle concurrent requests efficiently
135. MCP Tool API E2E Tests > Integration with Permission System > should respect custom permissions
136. MCP Tool API E2E Tests > Error Recovery > should handle and log various error conditions
137. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should successfully return authorization server metadata
138. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle different metadata configurations
139. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle metadata with minimal required fields only
140. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle metadata with all optional fields populated

## Batch 8 (Tests 141-160)
141. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should propagate errors from auth module not being loaded
142. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should propagate errors from oauth2ConfigService being undefined
143. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should propagate errors from oauth2ConfigService method failure
144. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle response.json method throwing an error
145. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should validate interface compliance with IOAuth2ServerMetadataInternal
146. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should handle empty arrays in metadata
147. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should preserve exact metadata structure without modification
148. AuthorizationServerEndpoint > getAuthorizationServerMetadata > should work with different request types
149. AuthorizationServerEndpoint > error boundary coverage > should handle auth module exports being null
150. AuthorizationServerEndpoint > error boundary coverage > should handle auth module exports being undefined
151. AuthorizationServerEndpoint > error boundary coverage > should handle oauth2ConfigService method being undefined
152. MCP Tool Permissions E2E > Tool Listing > should return check-status tool for admin session
153. MCP Tool Permissions E2E > Tool Listing > should return empty tool list for basic session
154. MCP Tool Permissions E2E > Tool Listing > should return empty tool list without session
155. MCP Tool Permissions E2E > Tool Execution > should allow admin to execute check-status tool
156. MCP Tool Permissions E2E > Tool Execution > should deny basic user from executing check-status tool
157. MCP Tool Permissions E2E > Tool Execution > should return error for unknown tool
158. MCP Tool Permissions E2E > Tool Execution > should require session for tool execution
159. MCP Tool Permissions E2E > Tool Arguments > should accept valid arguments for check-status
160. MCP Tool Permissions E2E > Tool Arguments > should handle invalid argument types

## Batch 9 (Tests 161-165)
161. MCP Tool Permissions E2E > Security Headers > should not expose internal metadata in tool list
162. MCP Tool Permissions E2E > Rate Limiting > should handle multiple rapid requests
163. MCP Tool Permissions E2E > Error Handling > should handle malformed JSON-RPC requests
164. MCP Tool Permissions E2E > Error Handling > should handle invalid method names
165. setupOAuth2Routes > should initialize all endpoint handlers with correct parameters