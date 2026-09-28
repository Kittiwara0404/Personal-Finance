/**
 * Price provider contract for future live-quote integrations (SET, broker APIs, crypto exchanges).
 * A provider resolves the latest price for a symbol; the portfolio module will call
 * providers in order and fall back to the user's manually entered price.
 *
 * @typedef {{ id: string, supports: (h: { symbol: string, assetClass: string }) => boolean,
 *             getPrice: (h: { symbol: string, assetClass: string }) => Promise<number | null> }} PriceProvider
 */

/** @type {PriceProvider} */
export const manualPriceProvider = {
  id: 'manual',
  supports: () => true,
  getPrice: async () => null,
};
