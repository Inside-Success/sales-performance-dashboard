// Isolated display proposal: preserve production content and metadata boundaries.
const {objectionSections}=require('../../src/lib/objection-coaching.cjs');
function nativeSections(report,blocks){const sections=objectionSections(report,blocks);return [...sections.filter(s=>s.key!=='strengths'),...sections.filter(s=>s.key==='strengths')];}
module.exports={nativeSections};
