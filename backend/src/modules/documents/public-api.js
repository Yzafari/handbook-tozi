// Stable cross-module contract. Other features must import this facade rather
// than depending on the documents module's internal service implementation.
export { getSearchDocumentsByIds } from './documents.service.js';
