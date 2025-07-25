// Debug script to understand issuer logic
const config1 = {
  id: 'test',
  name: 'Test',
  // no issuer property
};

const config2 = {
  id: 'test',
  name: 'Test',
  issuer: undefined
};

const config3 = {
  id: 'test',
  name: 'Test',
  issuer: null
};

const config4 = {
  id: 'test',
  name: 'Test',
  issuer: ''
};

const config5 = {
  id: 'test',
  name: 'Test',
  issuer: 'https://example.com'
};

console.log('config1 issuer:', config1.issuer);
console.log('config1 type:', config1.issuer !== null && config1.issuer !== '' ? 'oidc' : 'oauth2');

console.log('config2 issuer:', config2.issuer);
console.log('config2 type:', config2.issuer !== null && config2.issuer !== '' ? 'oidc' : 'oauth2');

console.log('config3 issuer:', config3.issuer);
console.log('config3 type:', config3.issuer !== null && config3.issuer !== '' ? 'oidc' : 'oauth2');

console.log('config4 issuer:', config4.issuer);
console.log('config4 type:', config4.issuer !== null && config4.issuer !== '' ? 'oidc' : 'oauth2');

console.log('config5 issuer:', config5.issuer);
console.log('config5 type:', config5.issuer !== null && config5.issuer !== '' ? 'oidc' : 'oauth2');