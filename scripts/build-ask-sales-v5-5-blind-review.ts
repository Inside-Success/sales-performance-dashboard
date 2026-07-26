import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;
type SystemName = "v3" | "v55";

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function output(result: JsonRecord) {
  return {
    answer: text(result.answer),
    disposition: text(result.lane) || text(result.outcome),
    needsRoute: result.needsRoute === true,
    routeChannels: Array.isArray(result.routeChannels) ? result.routeChannels : [],
  };
}

function groupMappings(datasetSha256: string, groupIds: string[]) {
  const ordered = [...groupIds].sort((left, right) =>
    sha256(`${datasetSha256}:${left}`).localeCompare(sha256(`${datasetSha256}:${right}`)),
  );
  return new Map(ordered.map((groupId, index): [string, { A: SystemName; B: SystemName }] => [
    groupId,
    index % 2 === 0 ? { A: "v3", B: "v55" } : { A: "v55", B: "v3" },
  ]));
}

function safeInlineJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function htmlDocument(packet: JsonRecord) {
  const inlinePacket = safeInlineJson(packet);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ask Sales blind answer review</title>
  <style>
    :root { color-scheme: light; --ink:#17223b; --muted:#60708c; --line:#dce3ef; --soft:#f5f7fb; --accent:#d92d38; --accent2:#243b72; --good:#0c7a55; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:#eef2f7; }
    .shell { max-width:980px; margin:0 auto; padding:24px 16px 64px; }
    header { background:#fff; border:1px solid var(--line); border-radius:18px; padding:22px; box-shadow:0 8px 30px rgba(24,36,64,.06); }
    h1 { font-size:25px; margin:0 0 8px; }
    h2 { font-size:18px; margin:0 0 10px; }
    p { line-height:1.55; }
    .muted { color:var(--muted); }
    .progressRow { display:flex; align-items:center; gap:12px; margin-top:18px; }
    .progress { height:10px; flex:1; background:#e8edf5; border-radius:99px; overflow:hidden; }
    .progress > div { height:100%; background:linear-gradient(90deg,var(--accent),#f06b70); width:0; transition:width .2s ease; }
    .card { background:#fff; border:1px solid var(--line); border-radius:18px; padding:22px; margin-top:18px; box-shadow:0 8px 30px rgba(24,36,64,.06); }
    .eyebrow { color:var(--accent); text-transform:uppercase; letter-spacing:.08em; font-size:12px; font-weight:800; }
    .question { font-size:22px; line-height:1.35; margin:8px 0 18px; }
    .gold { background:#fff8e8; border:1px solid #f2d796; border-radius:12px; padding:14px 16px; margin-bottom:18px; }
    .gold strong { display:block; margin-bottom:5px; }
    .answers { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .answer { border:1px solid var(--line); border-radius:14px; padding:16px; min-height:170px; background:#fff; }
    .answer h2 { display:flex; justify-content:space-between; gap:8px; }
    .answerText { white-space:pre-wrap; line-height:1.55; }
    fieldset { border:0; padding:0; margin:20px 0 0; }
    legend { font-weight:800; margin-bottom:10px; }
    .choices { display:flex; flex-wrap:wrap; gap:9px; }
    .choice { position:relative; }
    .choice input { position:absolute; opacity:0; pointer-events:none; }
    .choice span { display:block; padding:10px 14px; border:1px solid #bcc7d8; border-radius:10px; cursor:pointer; background:#fff; font-weight:650; }
    .choice input:checked + span { color:#fff; background:var(--accent2); border-color:var(--accent2); }
    textarea { width:100%; min-height:72px; border:1px solid #bcc7d8; border-radius:10px; padding:10px 12px; font:inherit; resize:vertical; }
    .nav { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:18px; }
    button { border:0; border-radius:10px; padding:11px 15px; font:inherit; font-weight:750; cursor:pointer; }
    button.primary { color:#fff; background:var(--accent); }
    button.secondary { color:var(--ink); background:#e6ebf3; }
    button:disabled { opacity:.45; cursor:not-allowed; }
    .save { color:var(--good); font-size:13px; min-height:20px; }
    .footerTools { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
    details { margin-top:16px; color:var(--muted); }
    summary { cursor:pointer; font-weight:700; }
    @media (max-width:720px) { .answers { grid-template-columns:1fr; } .question { font-size:19px; } .shell { padding:12px 10px 40px; } .card, header { padding:16px; border-radius:14px; } }
    @media print { body { background:#fff; } .nav,.footerTools,.progressRow { display:none; } .shell { max-width:none; } .card { box-shadow:none; break-inside:avoid; } }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div class="eyebrow">Blind human review</div>
      <h1>Choose the more useful and correct answer</h1>
      <p class="muted">The systems are hidden. Review one question at a time. The verified rule is shown so you do not have to remember it. Your choices are saved only in this browser and can be exported as JSON.</p>
      <div class="progressRow"><div class="progress"><div id="bar"></div></div><strong id="progressText"></strong></div>
    </header>
    <section class="card" id="reviewCard" aria-live="polite"></section>
    <section class="card">
      <h2>When you finish</h2>
      <p class="muted">Download or copy the feedback JSON and return that file/text for scoring. The identity key remains separate until the review is complete.</p>
      <div class="footerTools">
        <button class="primary" id="download">Download feedback JSON</button>
        <button class="secondary" id="copy">Copy feedback JSON</button>
        <button class="secondary" id="clear">Clear my saved choices</button>
      </div>
      <p class="save" id="toolStatus"></p>
    </section>
  </main>
  <script>
    const packet = ${inlinePacket};
    const items = packet.items;
    const storageKey = 'ask-sales-blind-review-' + packet.packetId;
    let memoryStorage = {};
    const safeStorage = (() => {
      try { localStorage.setItem('__ask_sales_storage_test__','1'); localStorage.removeItem('__ask_sales_storage_test__'); return localStorage; }
      catch { return { getItem:(key) => memoryStorage[key] || null, setItem:(key,value) => { memoryStorage[key]=value; }, removeItem:(key) => { delete memoryStorage[key]; } }; }
    })();
    let index = 0;
    let responses = JSON.parse(safeStorage.getItem(storageKey) || '{}');
    const esc = (value) => String(value ?? '').replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
    function answerPanel(label, output) {
      const route = output.routeChannels?.length ? '<p class="muted"><strong>Route:</strong> ' + esc(output.routeChannels.join(', ')) + '</p>' : '';
      return '<article class="answer"><h2>Answer ' + label + '</h2><div class="answerText">' + esc(output.answer) + '</div>' + route + '</article>';
    }
    function choices(name, values, selected) {
      return '<div class="choices">' + values.map(([value,label]) => '<label class="choice"><input type="radio" name="' + name + '" value="' + value + '" ' + (selected === value ? 'checked' : '') + '><span>' + label + '</span></label>').join('') + '</div>';
    }
    function render() {
      const item = items[index];
      const saved = responses[item.id] || {};
      const batch = Math.floor(index / 5) + 1;
      document.getElementById('progressText').textContent = (index + 1) + ' of ' + items.length;
      document.getElementById('bar').style.width = ((index + 1) / items.length * 100) + '%';
      document.getElementById('reviewCard').innerHTML =
        '<div class="eyebrow">Batch ' + batch + ' · Question ' + (index + 1) + '</div>' +
        '<div class="question">' + esc(item.question) + '</div>' +
        '<div class="gold"><strong>Verified rule</strong>' + esc(item.goldAnswer) + '</div>' +
        '<div class="answers">' + answerPanel('A', item.outputA) + answerPanel('B', item.outputB) + '</div>' +
        '<fieldset><legend>1. Which response would you trust a sales rep to use?</legend>' + choices('preference', [['A','A'],['B','B'],['both','Both are usable'],['neither','Neither is usable']], saved.preference) + '</fieldset>' +
        '<fieldset><legend>2. Does either response say something materially wrong or send the rep to the wrong place?</legend>' + choices('materialError', [['none','No'],['A','Yes — A'],['B','Yes — B'],['both','Yes — both']], saved.materialError) + '</fieldset>' +
        '<fieldset><legend>Optional short note</legend><textarea id="note" placeholder="Only add a note if something important is missing or wrong.">' + esc(saved.note || '') + '</textarea></fieldset>' +
        '<div class="nav"><button class="secondary" id="previous" ' + (index === 0 ? 'disabled' : '') + '>Previous</button><span class="save" id="saveStatus">Saved locally</span><button class="primary" id="next">' + (index === items.length - 1 ? 'Finish' : 'Save & next') + '</button></div>' +
        '<details><summary>Why this question is included</summary><p>' + esc(item.evaluationStrata.join(' · ')) + '</p></details>';
      document.querySelectorAll('input[type=radio]').forEach((input) => input.addEventListener('change', save));
      document.getElementById('note').addEventListener('input', save);
      document.getElementById('previous').addEventListener('click', () => { save(); index = Math.max(0, index - 1); render(); scrollTo({top:0,behavior:'smooth'}); });
      document.getElementById('next').addEventListener('click', () => { save(); if (index < items.length - 1) { index += 1; render(); scrollTo({top:0,behavior:'smooth'}); } else { document.getElementById('download').focus(); scrollTo({top:document.body.scrollHeight,behavior:'smooth'}); } });
    }
    function save() {
      const item = items[index];
      responses[item.id] = {
        preference: document.querySelector('input[name=preference]:checked')?.value || '',
        materialError: document.querySelector('input[name=materialError]:checked')?.value || '',
        note: document.getElementById('note')?.value || ''
      };
      safeStorage.setItem(storageKey, JSON.stringify(responses));
      const status = document.getElementById('saveStatus'); if (status) status.textContent = 'Saved locally';
    }
    function exportPayload() {
      save();
      return {
        schemaVersion: 'ask-sales-blind-human-review-v2',
        packetId: packet.packetId,
        packetSha256: packet.packetSha256,
        reviewedAt: new Date().toISOString(),
        systemsStillBlindedDuringReview: true,
        items: items.map((item) => ({ id:item.id, ...(responses[item.id] || {preference:'',materialError:'',note:''}) }))
      };
    }
    document.getElementById('download').addEventListener('click', () => { const blob = new Blob([JSON.stringify(exportPayload(),null,2)+'\\n'],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ask-sales-blind-review-feedback.json'; a.click(); URL.revokeObjectURL(a.href); document.getElementById('toolStatus').textContent='Feedback file downloaded.'; });
    document.getElementById('copy').addEventListener('click', async () => { const value=JSON.stringify(exportPayload(),null,2); try { await navigator.clipboard.writeText(value); } catch { const area=document.createElement('textarea'); area.value=value; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); } document.getElementById('toolStatus').textContent='Feedback JSON copied.'; });
    document.getElementById('clear').addEventListener('click', () => { if (confirm('Clear all saved choices for this review?')) { responses={}; safeStorage.removeItem(storageKey); index=0; render(); document.getElementById('toolStatus').textContent='Saved choices cleared.'; } });
    render();
  </script>
</body>
</html>`;
}

async function main() {
  const inputPath = path.resolve(argument("input", "artifacts/ask-sales-faq-v5-5-blind-gate/provider-corrected/primary-runtime.json"));
  const outputDirectory = path.resolve(argument("output-dir", "artifacts/ask-sales-faq-v5-5-blind-gate/provider-corrected"));
  const raw = await readFile(inputPath, "utf8");
  const report = object(JSON.parse(raw));
  if (text(report.status) !== "complete") throw new Error("Only a complete runtime report can be blinded");
  const datasetSha256 = text(report.datasetSha256);
  if (!datasetSha256) throw new Error("Runtime report is missing datasetSha256");

  const rows: Array<{ groupId: string; conversationId: string | null; item: JsonRecord }> = [];
  for (const item of Array.isArray(report.cases) ? report.cases.map(object) : []) rows.push({ groupId: text(item.id), conversationId: null, item });
  for (const conversation of Array.isArray(report.conversations) ? report.conversations.map(object) : []) {
    const conversationId = text(conversation.id);
    for (const item of Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) rows.push({ groupId: conversationId, conversationId, item });
  }
  if (rows.length !== 20) throw new Error(`Expected 20 review rows, received ${rows.length}`);
  const mappings = groupMappings(datasetSha256, [...new Set(rows.map((row) => row.groupId))]);
  const items = rows.map(({ groupId, conversationId, item }, index) => {
    const mapping = mappings.get(groupId)!;
    const systems = object(item.systems);
    return {
      id: text(item.id),
      order: index + 1,
      batch: Math.floor(index / 5) + 1,
      conversationId,
      question: text(item.question),
      goldAnswer: text(item.goldAnswer),
      evaluationStrata: Array.isArray(item.evaluationStrata) ? item.evaluationStrata : [],
      approvedBy: Array.isArray(item.approvedBy) ? item.approvedBy : [],
      outputA: output(object(systems[mapping.A])),
      outputB: output(object(systems[mapping.B])),
    };
  });
  const packetBase = {
    schemaVersion: "ask-sales-v5-5-blinded-review-packet-v2",
    packetId: `v55-blind-${datasetSha256.slice(0, 12)}`,
    createdAt: new Date().toISOString(),
    runtimeInputSha256: sha256(raw),
    datasetSha256,
    systemsHidden: true,
    instructions: {
      preference: "Choose A, B, both acceptable, or neither.",
      materialError: "Mark a response only when it states a materially wrong rule, gives unsafe guidance, or sends the rep to the wrong place.",
      note: "Optional and short.",
    },
    items,
  };
  const packetWithoutSelfHash = `${JSON.stringify(packetBase, null, 2)}\n`;
  const packet = { ...packetBase, packetSha256: sha256(packetWithoutSelfHash) };
  const packetRaw = `${JSON.stringify(packet, null, 2)}\n`;
  const mappingByItem = Object.fromEntries(rows.map((row) => [row.item.id, mappings.get(row.groupId)]));
  const key = {
    schemaVersion: "ask-sales-v5-5-unblind-key-v2",
    packetId: packet.packetId,
    packetContentSha256: packet.packetSha256,
    packetFileSha256: sha256(packetRaw),
    runtimeInputSha256: sha256(raw),
    datasetSha256,
    mappingByItem,
  };
  const template = {
    schemaVersion: "ask-sales-blind-human-review-v2",
    packetId: packet.packetId,
    packetSha256: packet.packetSha256,
    reviewedAt: null,
    reviewer: "",
    systemsStillBlindedDuringReview: true,
    items: items.map((item) => ({ id: item.id, preference: "", materialError: "", note: "" })),
  };
  const guide = `# Ask Sales blind answer review\n\nThis is the corrected provider-backed diagnostic packet. The root-level packet is invalid and superseded. Read \`TECHNICAL-READOUT.md\` for the verified comparison and evidence limits before drawing a production conclusion.\n\nOpen \`ASK-SALES-BLIND-REVIEW.html\` in a browser. It shows one question at a time in four batches of five.\n\nFor each question:\n\n1. Read the verified rule.\n2. Choose Answer A, Answer B, both usable, or neither usable.\n3. Mark an answer only if it says something materially wrong or sends the rep to the wrong place.\n4. Add a short note only when useful.\n\nAt the end, download or copy the feedback JSON. Do not open the unblind key until the review is complete.\n\nReturn the completed JSON and score it from the repository root with:\n\n\`\`\`bash\npnpm score:ask-sales-faq:v5-5:blind-review -- --dir=artifacts/ask-sales-faq-v5-5-blind-gate/provider-corrected --feedback=/absolute/path/to/ask-sales-blind-review-feedback.json\n\`\`\`\n\nThe scorer rejects incomplete or mismatched feedback, unblinds only after review, checks the fixed thresholds, independently enforces the current repeatability hold, and always leaves production promotion unauthorized until a separate approved release decision. These questions were exposed during the invalid first review, so the human result is diagnostic rather than fresh unseen promotion evidence.\n`;
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, "blinded-review-packet.json"), packetRaw, "utf8"),
    writeFile(path.join(outputDirectory, "sealed-unblind-key.json"), `${JSON.stringify(key, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputDirectory, "review-feedback-template.json"), `${JSON.stringify(template, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputDirectory, "ASK-SALES-BLIND-REVIEW.html"), htmlDocument(packet), "utf8"),
    writeFile(path.join(outputDirectory, "README.md"), guide, "utf8"),
  ]);
  process.stdout.write(`${JSON.stringify({ outputDirectory, packetId: packet.packetId, items: items.length, groups: mappings.size }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
