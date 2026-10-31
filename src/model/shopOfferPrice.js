// The cinders one configured-shop offer costs: its own rolled price, else the single stock price that saves made
// before per-offer prices carry.
export const shopOfferPrice = (stock, index) => stock?.options?.[index]?.price ?? stock?.price;
