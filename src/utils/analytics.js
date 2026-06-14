/**
 * analytics.js — GA4 custom event helpers
 * GA4 Property: G-PZ93GPEX4C
 *
 * Usage:
 *   import { trackWhatsAppClick, trackQuoteSubmit, trackEmailClick } from '../utils/analytics';
 */

const GA_ID = 'G-PZ93GPEX4C';

function gtag(...args) {
  if (typeof window !== 'undefined') {
    if (typeof window.gtag === 'function') {
      window.gtag(...args);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(args);
    }
  }
}

/** Track WhatsApp button/link clicks */
export function trackWhatsAppClick(source = 'unknown') {
  gtag('event', 'whatsapp_click', {
    event_category: 'engagement',
    event_label: source,
    send_to: GA_ID,
  });
}

/**
 * Track quote form successful submission.
 * Call AFTER confirmed Supabase success response.
 * @param {Object} details - { origin, destination, containerType }
 */
export function trackQuoteSubmit(details = {}) {
  gtag('event', 'quote_submit', {
    event_category: 'conversion',
    event_label: details.destination || 'unknown',
    origin_port: details.origin || '',
    destination_port: details.destination || '',
    container_type: details.containerType || '',
    send_to: GA_ID,
  });
}

/** Track email link clicks */
export function trackEmailClick(source = 'unknown') {
  gtag('event', 'email_click', {
    event_category: 'engagement',
    event_label: source,
    send_to: GA_ID,
  });
}

/** Track outbound link clicks */
export function trackOutboundLink(url, label = '') {
  gtag('event', 'click', {
    event_category: 'outbound',
    event_label: label || url,
    transport_type: 'beacon',
    send_to: GA_ID,
  });
}
