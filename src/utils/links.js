export const WA_NUM = "919136121123";

export const WHATSAPP_MESSAGES = {
  "/": "Hi Sattva, I came from the homepage and would like to discuss an export/import shipment from India.",
  "/services": "Hi Sattva, I saw your services page and would like help with freight forwarding for my shipment.",
  "/trade-lanes": "Hi Sattva, I saw your trade lanes page and would like to discuss the best route and pricing for my shipment.",
  "/why-sattva": "Hi Sattva, I read why exporters work with Sattva and would like to discuss my shipment.",
  "/knowledge": "Hi Sattva, I came from your knowledge section and would like guidance on my freight shipment.",
  "/freight-intelligence-desk": "Hi Sattva, I saw the Freight Intelligence Desk page. I’m interested in the 7-day preview access and would like to know how the India-lane freight signal notes work.",
  default: "Hi Sattva, I came from your website and would like to discuss my freight requirement.",
};

export const waLink = (msg) => `https://wa.me/${WA_NUM}?text=${encodeURIComponent(msg)}`;

export const pageWhatsAppMessage = (pathname = "/") => WHATSAPP_MESSAGES[pathname] || WHATSAPP_MESSAGES.default;

export const pageWhatsAppLink = (pathname = "/") => waLink(pageWhatsAppMessage(pathname));
