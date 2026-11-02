/** Route segments can arrive percent encoded; match stored names without fuzzy aliases. */
export function resolveRep(segment:string,names:string[]):string|null {
 if(names.includes(segment))return segment;
 try {const decoded=decodeURIComponent(segment);return names.includes(decoded)?decoded:null;}catch{return null;}
}
