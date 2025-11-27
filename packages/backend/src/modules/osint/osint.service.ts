import { env } from '../../config/env';
import { logger } from '../../utils/logger';

interface SearchResult {
  title: string;
  url: string;
  content?: string;
  publishedDate?: string;
  source?: string;
}

export const osintService = {
  async searchPhoneNumber(phoneNumber: string): Promise<SearchResult[]> {
    if (!env.FIRECRAWL_API_KEY) {
      logger.warn('FIRECRAWL_API_KEY is not set');
      // Return mock data if no key provided, for testing purposes or graceful degradation
      return [];
    }

    try {
      // Search for the phone number
      // We use specific queries to try to find profiles
      const query = `"${phoneNumber}"`;
      
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`
        },
        body: JSON.stringify({
          query,
          limit: 5,
          scrapeOptions: {
            formats: ['markdown']
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, error: errorText }, 'Firecrawl API error');
        return [];
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        return [];
      }

      return data.data.map((item: any) => ({
        title: item.title || 'No Title',
        url: item.url,
        content: item.markdown || item.content || '',
        publishedDate: item.publishedDate,
        source: new URL(item.url).hostname
      }));

    } catch (err) {
      logger.error({ err, phoneNumber }, 'OSINT search failed');
      return [];
    }
  }
};
