// Room codes: 4 letters, without I and O (easily confused with 1 and 0). Pure functions.
export const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LEN=4;
export const ROOM_TTL=10*60*1000; // a lobby stays open for 10 minutes (same value in database.rules.json)

export function randomCode(rand=Math.random){
  let s='';
  for(let i=0;i<CODE_LEN;i++)s+=ALPHABET[Math.floor(rand()*ALPHABET.length)];
  return s;
}
export const cleanCode=raw=>String(raw||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,CODE_LEN);
export const validCode=c=>new RegExp(`^[${ALPHABET}]{${CODE_LEN}}$`).test(c);
