import { buildNumericRegexes, buildEntityNameRegex } from "../src/dsl/compiler/deterministic-verifier";

const samplePage = `
DBS Hong Kong Accounts Receivable Purchasing and Supplier Financing.
We finance invoices up to 90% advance rate.
Minimum facility turnover starts from HKD 5,000,000 or USD 500,000. Maximum facility up to USD 20,000,000.
Eligible seller jurisdictions: Hong Kong, Singapore, Mainland China.
Documents required: Audited Financial Statements, Certificate of Incorporation, Debtor Aging Report, Invoice and Bill of Lading.
Key Contact: Kelvin Lam, Head of SME Receivables. Email: kelvin.lam@dbs.com.
`;

console.log("Found entity 'DBS':", buildEntityNameRegex("DBS Hong Kong").test(samplePage));
console.log("Found 90%:", buildNumericRegexes(90).some(r => r.test(samplePage)));
console.log("Found $500,000:", buildNumericRegexes(500000).some(r => r.test(samplePage)));
console.log("Found $20,000,000:", buildNumericRegexes(20000000).some(r => r.test(samplePage)));
console.log("Found Hong Kong:", /hong\s*kong/i.test(samplePage));
console.log("Found 'Kelvin Lam':", buildEntityNameRegex("Kelvin Lam").test(samplePage));
console.log("Found 'Audited Financial Statements':", /financial\s*statements/i.test(samplePage));
console.log("Found non-existent '100,000,000':", buildNumericRegexes(100000000).some(r => r.test(samplePage)));
console.log("Found non-existent 'Sarah Jenkins':", buildEntityNameRegex("Sarah Jenkins").test(samplePage));
