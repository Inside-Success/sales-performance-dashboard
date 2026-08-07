export type SalesSheetColumnIndexes = {
  date: number;
  paymentStatus: number;
  paymentType: number;
  amount: number;
  salesRep: number;
  showName: number;
  contractSigned: number;
};

const PAYMENT_TYPE_HEADERS = [
  "payment type (new/recurring)",
  "payment type (new/recurring/initial remaining)",
];

export function getSalesSheetColumnIndexes(headers: string[]): SalesSheetColumnIndexes {
  const headerMap = new Map(headers.map((header, index) => [normalizeHeader(header), index]));

  return {
    date: requireColumn(headerMap, ["date"]),
    paymentStatus: requireColumn(headerMap, ["payment status"]),
    paymentType: requireColumn(headerMap, PAYMENT_TYPE_HEADERS),
    amount: requireColumn(headerMap, ["amount"]),
    salesRep: requireColumn(headerMap, ["sales rep"]),
    showName: headerMap.get("show name") ?? -1,
    contractSigned: headerMap.get("contract signed") ?? -1,
  };
}

function requireColumn(headerMap: Map<string, number>, acceptedNames: string[]) {
  for (const name of acceptedNames) {
    const index = headerMap.get(name);
    if (typeof index === "number") return index;
  }

  throw new Error(`Missing required sales sheet column: ${acceptedNames.join(" or ")}`);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
