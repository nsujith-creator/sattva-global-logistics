export const FREE_DOMAINS=["gmail.com","yahoo.com","yahoo.in","hotmail.com","outlook.com","rediffmail.com","ymail.com","live.com","icloud.com","aol.com","protonmail.com"];
export const isFreeEmail=(email)=>{const d=email.split("@")[1]?.toLowerCase();return FREE_DOMAINS.includes(d);};
