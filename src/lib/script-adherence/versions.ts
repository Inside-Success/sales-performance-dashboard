import {RUBRICS, RUBRIC_VERSION, type ScriptId, type Action} from './rubric';
export const LEGACY_VERSION=RUBRIC_VERSION;
export const UPDATED_VERSION='script-adherence-2026-11-10-v2';
export type Rubric= {label:string;source:string;actions:Action[]};
const a=(id:string,label:string,components:string[],when?:string,video?:string):Action=>({id,label,components,...(when?{when}:{}),...(video?{video}:{})});
const onboarding='Payment is confirmed and prospect proceeds to production onboarding, or a production onboarding appointment is actually arranged';
const updated:Partial<Record<ScriptId,Rubric>>=structuredClone(RUBRICS);
for(const id of ['documentary_call_1','reality_call_1'] as const){
 const fit=updated[id]!.actions.find(a=>a.id==='financial_fit')!;
 fit.components=['Explains that participation involves licensing, travel or other costs','Asks whether continuing is suitable'];
}
updated.reality_call_1!.actions.find(a=>a.id==='video_1')!.when='Prospect is being advanced';
updated.reality_call_2={label:'Reality · Call 2',source:'114byDd_3imo1jGBrtobmOmPl1ZO_qBJ_dlI5SQLYQFI',actions:[
 a('consent','Recording consent',['Rep discloses recording','Prospect agrees']),
 a('welcome','Welcome and set the agenda',['Asks how they feel about the greenlight or what excites them','Explains casting, logistics and costs agenda']),
 a('greenlight','Review the greenlight',['Reviews approved greenlight or production document','Connects selection to their story or personality']),
 a('motivation','Confirm their main motivation',['Asks whether personal brand or experience is their main motivation','Checks that this still matches their expectations']),
 a('motivation_depth','Explore their chosen motivation',['Explores desired benefits of the chosen motivation','Explores why those benefits matter personally']),
 a('media','Discuss media exposure and sharing',['Explains uses of approved promotional assets','Asks about comfort with media exposure or sharing']),
 a('future','Explore their longer-term goals',['Asks how they want to be remembered','Connects the experience to personal or business goals']),
 a('partner','Invite questions and relevant partners',['Asks for major questions before logistics','Asks whether a relevant partner should join']),
 a('video_1','Video 1 — License',['At least half of the relevant license video played'],undefined,'Reality Call 2 license rights, package and fees presentation. The source calls this License Video #2; it is the first required video on this Call 2 checklist. Not Call 1 orientation or show pitch.'),
 a('proceed','Ask to move forward',['Asks to begin payment and finalize participation']),
 a('terms','Explain the payment plan',['Explains the total package price','Explains installments and billing schedule']),
 a('objections','Address stated concerns',['Acknowledges the actual concern','Responds to that concern or agrees an appropriate review/follow-up'],'Prospect raises a concern; this measures occurrence, not handling quality'),
 a('payment','Help with payment',['Provides or explains payment step','Verifies completed payment'],'Prospect agrees to attempt payment, or payment is actually attempted'),
 a('agreement','Allow agreement review',['Explains the agreement and opportunity to review','Explains relevant rights, refund terms and exclusions or supports requested independent agreement review','Addresses requested contract questions if requested'],'Agreement is offered, requested or reviewed, or payment is completed'),
 a('video_2','Video 2 — Contract review (when needed)',['At least half of the contract review video played'],'Prospect requests or accepts the contract walkthrough, or it is actually played','Three-to-four-minute Reality cast agreement Loom. Optional walkthrough, not the license presentation or welcome-video homework.'),
 a('signature','Confirm agreement signing',['Independently confirms signature'],'Prospect proceeds with signing or reports signing the agreement'),
 a('onboarding','Arrange onboarding',['Offers an available appointment','Agrees date and time'],onboarding),
 a('invite','Confirm onboarding invitation',['Checks calendar invitation receipt'], 'Onboarding is booked'),
 a('welcome_email','Confirm welcome email',['Shows or explains welcome email','Checks receipt'],onboarding),
 a('form','Explain onboarding form',['Explains the onboarding form','Gives its actual deadline'],onboarding),
 a('homework','Set welcome-video preparation',['Asks prospect to watch the welcome video this week'],onboarding),
 a('cast_contact','Explain cast-contact rule',['Explains not contacting other cast members before filming'],onboarding),
 a('social','Explain promotional assets',['Explains access to social assets','Encourages sharing'],onboarding),
 a('support','Explain production support',['Identifies the production support email','Explains where production or logistics questions should go'],onboarding),
]};
export function rubricsFor(version:string=LEGACY_VERSION):Partial<Record<ScriptId,Rubric>>{
 if(version===LEGACY_VERSION)return RUBRICS;
 if(version===UPDATED_VERSION)return updated;
 throw Error('Unknown script version; preserve saved result and hold processing');
}
export function selectVersion(startedAt:string,activation:string|null|undefined,activeVersion:string|null|undefined){
 if(!activation||!activeVersion)return LEGACY_VERSION;
 rubricsFor(activeVersion);
 const start=Date.parse(startedAt),cutoff=Date.parse(activation);
 if(!Number.isFinite(start)||!Number.isFinite(cutoff))throw Error('Invalid script activation date');
 return start>=cutoff?activeVersion:LEGACY_VERSION;
}
// Saved paid request is the authority, including old requests created before version pinning.
export function requestVersion(body:unknown){
 const b=body as {messages?:Array<{role:string;content:string}>;system?:Array<{text:string}>};
 const system=b?.messages?.find(m=>m.role==='system')?.content||b?.system?.map(s=>s.text).join('\n')||'';
 const match=system.match(/Version (script-adherence-[\w-]+)\./);
 if(!match)throw Error('Request has no script version');
 rubricsFor(match[1]);return match[1];
}
