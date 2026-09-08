/** Private, offline preview. No server, database access or usage events. */
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import {CoachingReportContent} from '../../src/components/dashboard/coaching-report-content';
(globalThis as unknown as {React:typeof React}).React=React;
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: render-preview.tsx private-report.json private-output.html');
const report=JSON.parse(fs.readFileSync(input,'utf8'));
const cssDir=path.resolve('.next/static/chunks');
const css=fs.readdirSync(cssDir).filter(x=>x.endsWith('.css')).map(x=>fs.readFileSync(path.join(cssDir,x),'utf8')).join('\n');
fs.writeFileSync(output,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><main class="magic-page"><article class="magic-container max-w-5xl space-y-4"><h1 class="text-3xl font-semibold">Coaching report preview</h1>'+renderToStaticMarkup(<CoachingReportContent report={report}/> )+'</article></main></body></html>');
