// Create a Stripe Payment Link (no code needed, free to set up) at
// https://dashboard.stripe.com/payment-links, then set it as VITE_STRIPE_PAYMENT_LINK
// in the project's environment variables.
export const STRIPE_PREMIUM_PAYMENT_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK || "";
