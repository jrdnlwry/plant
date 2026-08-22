(() => {
  const SITE_ORIGIN = 'http://localhost:3000';

  function siteUrl(pathname, query) {
    const url = new URL(SITE_ORIGIN);
    url.pathname = `/${String(pathname).replace(/^\/+/, '')}`;
    if (query) {
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    }
    return url.toString();
  }

  globalThis.PlantSite = Object.freeze({
    origin: SITE_ORIGIN,
    accountLinkChallengeUrl: () => siteUrl('/api/extension/link/challenges'),
    accountLinkStatusUrl: () => siteUrl('/api/extension/link/status'),
    accountLinkApprovalUrl: (challenge) => siteUrl('/account/link-extension', { challenge }),
    publicationSubmissionUrl: () => siteUrl('/api/extension/publication/submit'),
    gardenUrl: (publicGardenPath) => siteUrl(publicGardenPath),
  });
})();
