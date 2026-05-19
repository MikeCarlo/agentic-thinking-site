/**
 * Appends campaign UTM parameters to external URLs
 * @param url - The URL to append parameters to
 * @returns The URL with campaign parameters appended
 */
export const addCampaignParams = (url: string): string => {
  if (!url || typeof url !== 'string') {
    return url;
  }

  // Don't add params to internal links, mailto, or relative URLs
  if (!url.startsWith('http')) {
    return url;
  }

  const campaignParams = 'utm_source=agentic_thinking&utm_medium=website&utm_campaign=20260520';

  // Check if URL already has query parameters
  if (url.includes('?')) {
    return `${url}&${campaignParams}`;
  }

  return `${url}?${campaignParams}`;
};
