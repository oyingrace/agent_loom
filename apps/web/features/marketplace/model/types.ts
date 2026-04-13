export type MarketplaceProxy = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  proxyUrl: string;
  pricingAsset: string;
  pricingAmount: string;
  category: string | null;
  tags: string[];
  httpMethod: string;
  createdAt: string;
};
