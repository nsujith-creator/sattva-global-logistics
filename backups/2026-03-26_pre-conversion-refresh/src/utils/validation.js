// Consumer / free email domain blocklist
// Indian + global providers covered
const FREE_DOMAINS = [
  // Google
  "gmail.com","googlemail.com",
  // Microsoft
  "hotmail.com","hotmail.in","hotmail.co.uk","outlook.com","outlook.in",
  "live.com","live.in","msn.com","windowslive.com",
  // Yahoo
  "yahoo.com","yahoo.in","yahoo.co.in","yahoo.co.uk","ymail.com","rocketmail.com",
  // Apple
  "icloud.com","me.com","mac.com",
  // Russian
  "yandex.com","yandex.ru","yandex.in","mail.ru","rambler.ru","bk.ru","list.ru","inbox.ru",
  // Indian free providers
  "rediffmail.com","indiatimes.com","sify.com","vsnl.net",
  // Other global free providers
  "aol.com","aim.com","protonmail.com","proton.me","tutanota.com","tutanota.de",
  "zoho.com","zohomail.com",
  "gmx.com","gmx.net","gmx.de","web.de",
  "fastmail.com","fastmail.fm","hushmail.com",
  "lycos.com","excite.com","netscape.net",
  "mailfence.com","posteo.net","disroot.org",
  "guerrillamail.com","sharklasers.com","guerrillamailblock.com",
  "mailinator.com","trashmail.com","tempmail.com","throwam.com",
  "temp-mail.org","fakeinbox.com","mailnull.com","maildrop.cc",
  // Telecom free emails (India)
  "airtelmail.in","bsnl.in",
];

export const isFreeEmail = (email) => {
  const d = email.split("@")[1]?.toLowerCase().trim();
  if (!d) return false;
  return FREE_DOMAINS.includes(d);
};

export const isValidEmail = (email) => /^[^@]+@[^@]+\.[^@]{2,}$/.test(email.trim());
