// Which copy of Telmyn this is. The real app ships 'live'. The separate test app (its own web address,
// its own icon, its own storage) is deployed by tools/test-site.ps1, which swaps this file for test-site/js/site.js.
// The real app has no test mode at all, so nothing in it can switch to or touch test data.
export const SITE = 'live';
