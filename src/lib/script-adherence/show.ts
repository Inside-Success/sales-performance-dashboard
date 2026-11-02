// Formatting aliases only; never infer the show from a title or change its family.
export function canonicalShow(show:string){
 const key=show.toLowerCase().replace(/[^a-z0-9]/g,'');
 const aliases:Record<string,string>={entrepreneurisland:'Entrepreneurs Island',entrepreneursisland:'Entrepreneurs Island',womeninpower:'Women in Power',americasbestdoctors:"America’s Best Doctors",bluecollaramerica:'Blue Collar America',nextlevelceo:'Next Level CEO',legacymakers:'Legacy Makers',businessrace:'Business Race',businessraceuk:'Business Race UK',mansionofmoney:'Mansion of Money',operationprofit:'Operation Profit'};
 return aliases[key]??show.trim();
}
