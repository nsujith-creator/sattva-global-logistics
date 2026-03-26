import { ALL_POD, POL } from "../data/ports";

export const pn=c=>{const p=POL.find(x=>x.c===c)||ALL_POD.find(x=>x.c===c);return p?p.n:c;};
