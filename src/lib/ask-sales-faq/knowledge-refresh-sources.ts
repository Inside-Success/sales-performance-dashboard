export type KnowledgeRefreshSourceKind = "slack_channel" | "google_doc" | "google_sheet";

export type KnowledgeRefreshSourceDefinition = {
  id: string;
  kind: KnowledgeRefreshSourceKind;
  label: string;
  externalId: string;
  url: string;
  enabled: boolean;
  replacementSourceId?: string;
};

const GOOGLE_DOC_IDS = [
  "105q-WjisE2DcHVzKGDXtKURT5NE9rml-u-pAY0_o0Do",
  "11uEmCRyJxw2koPoPnFZNySLJVYD9722VDzoLyDV9tOg",
  "12nMn-bIdqdo84-UJdaswpgwys9wUx7lXAMZBXQFhoCk",
  "17AeELjukYKUDbpKtr07PG8peYJWJAKYkfgNHOjCyrb4",
  "19OFDpep0EetH5Pr1xW-5MnmPRgli-XHRrMGtHIIp15k",
  "1AweNEmoTACqKYfyUY-AxjLEK4FzVBN1wr24T1prsWbM",
  "1DPGTSrLth0CE2e71lbo3TQPJzjHv0sY-tIxGwfF00EY",
  "1ER-SvUVj2cwO94yCPSvz9Hk8OWOdmYMvpzFzDAjB7eU",
  "1GGVlvdJFTqZH12bCA0zevDBjXDbBbZvusJHsRFIsAeQ",
  "1GHvmHjmR28geXQhg0GeGAuqQeDvhuhgt",
  "1KsgYA-jW8LsYC-Zqmp1fVr0Hel9dtAr2xRdDz2u154Y",
  "1Mg6_dxHiieQKMerkVzvlvTcfrd9ckd1glelVNIBMB-Y",
  "1NN1TDptK-ef4fDSCBGeX_xqQvOyU2P3PAhX3Eb7Msc8",
  "1ODrKDDK9jko48uXTQVFhOr-RxwBMmCrCjrtkDCVKUQc",
  "1P1my5QGrvkL9Bg_7ad3bk3CL_37n2JgUioFLeY3jsXM",
  "1URzpTFkCQt4O_y7m6jOhDT_lxQzy_xENqSdr5hIj8DM",
  "1UsagbQCvQV6EuguPsslydlvdbOFGD2GTsj0oSw57e68",
  "1WOiA8L3_kIt1xEDnDun7TPnlyPG11kFBIb5OMnrLwOc",
  "1XC0q0OEvnEaicGKmutfh5fkf6rpDV-BShPJTgftMkTk",
  "1YW6Z0NEYb8Ot8mSv3iDAFxCpTohhiQxIxhl0eygPcTw",
  "1Yryv722wjWZoHLZTvc210z5rXjhf9efbuqGc8A4e5zI",
  "1_Lb95IF0ZUK6TcAfBZhE7q1iSuTSP4Zci5bcnrefkXU",
  "1aMTwXf0u6bDzoXctE0-bRmwBUKBo5P438k1bcQhhSrc",
  "1c7JqQvi8VMotQFJ36paVkT6a5huFP1BRnYHxvj7q2gw",
  "1fbBGTEXo3DKQZXIsJCinFMskqB8nCSGW1pQKvX4LUO8",
  "1ffWEESzNgQ9L1mO25fAPDIJCD86k29sqeS05fO0KxoE",
  "1gmTU4pX0o56QnZgNrJ9b4oIxHfBI1hl6eQ8qarULWrg",
  "1kKDjGpCWrVAaLh6cKTSZKJ_YZEqtczHUcpuYFTAt3jo",
  "1ljBEsaKAIoZ2EIo7s0sP1M_cc2hu-b5uHN2G0uC3r9c",
  "1lm6dWmMLUQJ83oegGZrTaA29c-rw4hJfkwTXQ4zx9Q4",
  "1mxuqrEVvocGwDlrniWam-fKcEBhtX5qwgdB07fdJS4k",
  "1mz8fp_iq9Jovzc3RTwVjKYQqJvJw9Ej-bYuJdEK3Xsc",
  "1o_gigS0DpCVgWyZcmpinidGYUz3S0KjicWTmRR6gu_4",
  "1pawkadA9Tx-wwKqepY1yVhJP9ry8bahnffOk3uJfOzI",
  "1szwc1ij0bJ6dUy-BXMzpR0ji5Wb3bge7qxzEqmZm5To",
  "1tJZLBW3OvcNFv4fjaMvg3S449wX2DHU4cG5-xfU0zxU",
  "1uJLbh7t6rOt_AjFYnqEINK2Qg09b9e0iLwmbZorquIU",
] as const;

const GOOGLE_SHEET_IDS = [
  "1R-8BnPOygF8EQbFo9KFiJcc7Xw0F6xlwSE3m6Rnv8Ic",
  "1geZ14Hdwm0P8l8qkYe0u0kOAO2GRHxXFuP3v3iOEv2E",
  "1jaUiw0cz5OCdBD5J7A1dUaTIo6dxqQgTCw3hpbCS0rg",
  "1xIqHh5uAkoKMgYNk1fHox1YfDuBUzGzbn--R7t0_syM",
] as const;

const SOURCE_LABELS: Record<string, string> = {
  "1DPGTSrLth0CE2e71lbo3TQPJzjHv0sY-tIxGwfF00EY": "Updated onboarding cheat sheet",
  "1WOiA8L3_kIt1xEDnDun7TPnlyPG11kFBIb5OMnrLwOc": "Main sales onboarding document 1",
  "1gmTU4pX0o56QnZgNrJ9b4oIxHfBI1hl6eQ8qarULWrg": "Welcome and onboarding email",
  "1tJZLBW3OvcNFv4fjaMvg3S449wX2DHU4cG5-xfU0zxU": "Main sales onboarding document 2",
  "1geZ14Hdwm0P8l8qkYe0u0kOAO2GRHxXFuP3v3iOEv2E": "All SOPs sheet",
};

function googleSource(kind: "google_doc" | "google_sheet", externalId: string): KnowledgeRefreshSourceDefinition {
  const noun = kind === "google_doc" ? "document" : "spreadsheet";
  return {
    id: `${kind}:${externalId}`,
    kind,
    label: SOURCE_LABELS[externalId] || `Google ${noun} ${externalId.slice(0, 8)}`,
    externalId,
    url: `https://docs.google.com/${kind === "google_doc" ? "document" : "spreadsheets"}/d/${externalId}`,
    enabled: true,
  };
}

export const KNOWLEDGE_REFRESH_SOURCES: KnowledgeRefreshSourceDefinition[] = [
  {
    id: "slack_channel:C0AUQKNR8CF",
    kind: "slack_channel",
    label: "#sales-questions-requests",
    externalId: "C0AUQKNR8CF",
    url: "https://istvoffical.slack.com/archives/C0AUQKNR8CF",
    enabled: true,
  },
  {
    id: "slack_channel:C09AF0NQJE7",
    kind: "slack_channel",
    label: "#2026-main-all-sales-reps-no-questions",
    externalId: "C09AF0NQJE7",
    url: "https://istvoffical.slack.com/archives/C09AF0NQJE7",
    enabled: true,
  },
  ...GOOGLE_DOC_IDS.map((id) => googleSource("google_doc", id)),
  ...GOOGLE_SHEET_IDS.map((id) => googleSource("google_sheet", id)),
];

export function getKnowledgeRefreshSource(sourceId: string) {
  return KNOWLEDGE_REFRESH_SOURCES.find((source) => source.id === sourceId) || null;
}
