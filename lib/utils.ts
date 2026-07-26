export const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');
export const mean = (values: number[]) => values.length ? values.reduce((a,b) => a+b, 0) / values.length : 0;
export const median = (values: number[]) => { const s = [...values].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length ? (s.length % 2 ? s[m] : (s[m-1]+s[m])/2) : 0; };
