import test from "node:test";
import assert from "node:assert/strict";
import { createMailSender } from "../utils/mail.util.js";
import { __emailTestUtils, createSendLpaEmailHandler } from "../controllers/lpa/lpaEmail.controller.js";

const makeRequestResponse = (body, idempotencyKey = "request-1") => {
  const req = { user: { id: "user-1" }, body, get: name => name === "Idempotency-Key" ? idempotencyKey : undefined };
  const res = {
    statusCode: null,
    responseBody: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.responseBody = value; return this; }
  };
  return { req, res };
};

const invokeHandler = (handler, req, res) => new Promise((resolve, reject) => {
  handler(req, res, error => error ? reject(error) : resolve());
  setImmediate(resolve);
});

test("mail sender passes all recipients and sheet links to SMTP and returns provider result", async () => {
  let transportOptions;
  let sentMessage;
  let closed = false;
  const expected = { messageId: "accepted-id", accepted: ["one@example.com", "two@example.com"], rejected: [] };
  const send = createMailSender({
    env: { SMTP_HOST: "smtp.test", SMTP_PORT: 587, SMTP_USERNAME: "sender@example.com", SMTP_PASSWORD: "secret" },
    createTransport: options => {
      transportOptions = options;
      return {
        async sendMail(message) { sentMessage = message; return expected; },
        close() { closed = true; }
      };
    },
    getSettings: async () => ({}),
    log: { error() {} }
  });

  const result = await send(["one@example.com", "two@example.com"], "CMS sheets", "<a href=\"https://portal.test/cms/lpa\">Open</a>", [], ["copy@example.com"]);

  assert.equal(result, expected);
  assert.deepEqual(sentMessage.to, ["one@example.com", "two@example.com"]);
  assert.deepEqual(sentMessage.cc, ["copy@example.com"]);
  assert.match(sentMessage.html, /\/cms\/lpa/);
  assert.equal(transportOptions.tls.minVersion, "TLSv1.2");
  assert.equal(transportOptions.tls.rejectUnauthorized, undefined);
  assert.equal(transportOptions.secure, false);
  assert.equal(transportOptions.requireTLS, true);
  assert.equal(closed, true);
});

test("mail sender fails closed when SMTP credentials are absent", async () => {
  let transportCreated = false;
  const send = createMailSender({
    env: { SMTP_HOST: "smtp.test", SMTP_USERNAME: "sender@example.com" },
    getSettings: async () => ({}),
    createTransport() { transportCreated = true; },
    log: { error() {} }
  });

  await assert.rejects(send(["one@example.com"], "CMS sheets", "body"), { code: "SMTP_NOT_CONFIGURED" });
  assert.equal(transportCreated, false);
});

test("mail sender prefers the existing stored SMTP settings", async () => {
  let transportOptions;
  let from;
  const send = createMailSender({
    env: {},
    getSettings: async () => ({
      smtpHost: "smtp.saved.example",
      smtpPort: 465,
      smtpUsername: "saved-user@example.com",
      smtpPassword: "stored-secret",
      smtpEncryption: "ssl",
      fromEmail: "noreply@example.com",
      fromName: "CMS Portal"
    }),
    createTransport: options => {
      transportOptions = options;
      return { async sendMail(message) { from = message.from; return { accepted: ["to@example.com"], rejected: [] }; }, close() {} };
    },
    log: { error() {} }
  });

  await send(["to@example.com"], "Subject", "Body");
  assert.equal(transportOptions.host, "smtp.saved.example");
  assert.equal(transportOptions.auth.user, "saved-user@example.com");
  assert.equal(transportOptions.auth.pass, "stored-secret");
  assert.equal(transportOptions.secure, true);
  assert.equal(transportOptions.requireTLS, false);
  assert.equal(from, "CMS Portal <noreply@example.com>");
});

test("recipient parsing retains every unique valid To address and rejects malformed entries", () => {
  assert.deepEqual(
    __emailTestUtils.parseAddresses(["one@example.com", "two@example.com", "ONE@example.com"], "To"),
    ["one@example.com", "two@example.com"]
  );
  assert.throws(() => __emailTestUtils.parseAddresses(["valid@example.com", "invalid"], "To"), /invalid/i);
});

test("email links target the selected Assembly workbook and section-specific LPA PDCA sheet", () => {
  const { assemblyUrl, pdcaUrl, html } = __emailTestUtils.buildSheetEmail(
    { workbookId: "assembly-1", sheetIndex: 2, name: "Assembly <Audit>" },
    { id: "lpa-pdca-1", source: "lpa", section: "cc", unit: "Bawal", name: "C&C Observation" }
  );

  const assembly = new URL(assemblyUrl);
  const pdca = new URL(pdcaUrl);
  assert.equal(assembly.pathname, "/cms/lpa");
  assert.equal(assembly.searchParams.get("viewWorkbookId"), "assembly-1");
  assert.equal(assembly.searchParams.get("sheetIndex"), "2");
  assert.equal(pdca.pathname, "/cms/lpa");
  assert.equal(pdca.searchParams.get("viewPdcaSheetId"), "lpa-pdca-1");
  assert.equal(pdca.searchParams.get("section"), "cc");
  assert.match(html, /Assembly &lt;Audit&gt;/);
});

test("email endpoint returns success only after provider acceptance and deduplicates request retries", async () => {
  let sendCount = 0;
  let sentTo;
  let sentHtml;
  const sendHandler = createSendLpaEmailHandler({
    sendMailFn: async (to, _subject, html) => {
      sendCount += 1;
      sentTo = to;
      sentHtml = html;
      return { messageId: "provider-accepted-id", accepted: to, rejected: [] };
    },
    getLpaRecord: async id => ({ id, section: "assembly", sheets: [{ rows: [] }, { rows: [[{ value: "saved" }]] }] }),
    getPdcaRecord: async id => ({ id, sheet: { rows: [{ observation: "Saved observation" }] } }),
    attemptStore: new Map(),
    portalBaseUrl: "https://portal.example"
  });
  const body = {
    to: ["one@example.com", "two@example.com"],
    cc: [],
    subject: "Selected CMS sheets",
    assemblySheet: { workbookId: "book-1", sheetIndex: 1, name: "Assembly" },
    pdcaSheet: { id: "PDCA-LPA-1", source: "lpa", section: "assembly", name: "Observation" }
  };
  const first = makeRequestResponse(body);
  await invokeHandler(sendHandler, first.req, first.res);

  assert.equal(first.res.statusCode, 200);
  assert.equal(first.res.responseBody.message, "Email accepted by the configured mail service.");
  assert.deepEqual(sentTo, body.to);
  assert.match(sentHtml, /viewWorkbookId=book-1/);
  assert.match(sentHtml, /viewPdcaSheetId=PDCA-LPA-1/);

  const retry = makeRequestResponse(body);
  await invokeHandler(sendHandler, retry.req, retry.res);
  assert.equal(retry.res.statusCode, 200);
  assert.equal(sendCount, 1);
});

test("PDCA-only email sends the selected PDCA sheet without requiring an LPA workbook", async () => {
  let sentSubject;
  let sentHtml;
  let lpaLookupCount = 0;
  const sendHandler = createSendLpaEmailHandler({
    sendMailFn: async (_to, subject, html) => {
      sentSubject = subject;
      sentHtml = html;
      return { accepted: ["one@example.com"], rejected: [] };
    },
    getLpaRecord: async () => { lpaLookupCount += 1; return null; },
    getPdcaRecord: async id => ({ id, sheet: { rows: [{ observation: "Saved PDCA observation" }] } }),
    attemptStore: new Map(),
    portalBaseUrl: "https://portal.example"
  });
  const { req, res } = makeRequestResponse({
    emailMode: "pdca-only",
    to: ["one@example.com"],
    cc: [],
    pdcaSheet: { id: "pdca-9", source: "pdca", section: "assembly", name: "PDCA report" }
  }, "pdca-only-email");

  await invokeHandler(sendHandler, req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(lpaLookupCount, 0);
  assert.equal(sentSubject, "PDCA Sheet");
  assert.match(sentHtml, /sheet=pdca-9/);
  assert.match(sentHtml, /METRICS:/);
  assert.match(sentHtml, /Not-Started/);
  assert.doesNotMatch(sentHtml, /viewWorkbookId=/);
  assert.equal(res.responseBody.data.links.assembly, undefined);
  assert.equal(res.responseBody.data.links.pdca, "https://portal.example/cms/pdca?sheet=pdca-9");
});

test("PDCA-only email rejects deleted records before sending", async () => {
  let sendCount = 0;
  const sendHandler = createSendLpaEmailHandler({
    sendMailFn: async () => { sendCount += 1; return { accepted: ["one@example.com"], rejected: [] }; },
    getPdcaRecord: async id => ({ id, isDeleted: true, sheet: { rows: [{ observation: "Deleted" }] } }),
    attemptStore: new Map(),
    portalBaseUrl: "https://portal.example"
  });
  const { req, res } = makeRequestResponse({
    emailMode: "pdca-only",
    to: ["one@example.com"],
    cc: [],
    pdcaSheet: { id: "deleted-pdca", source: "pdca", section: "assembly" }
  }, "deleted-pdca-mail");

  await invokeHandler(sendHandler, req, res);
  assert.equal(res.statusCode, 404);
  assert.equal(sendCount, 0);
});

test("email endpoint rejects an Assembly workbook that no longer exists", async () => {
  let sendCount = 0;
  const sendHandler = createSendLpaEmailHandler({
    sendMailFn: async () => { sendCount += 1; return { accepted: ["one@example.com"], rejected: [] }; },
    getLpaRecord: async () => null,
    attemptStore: new Map(),
    portalBaseUrl: "https://portal.example"
  });
  const { req, res } = makeRequestResponse({
    to: ["one@example.com"],
    cc: [],
    assemblySheet: { workbookId: "deleted-book", sheetIndex: 0 },
    pdcaSheet: { id: "lpa-pdca-1", source: "lpa", section: "assembly" }
  }, "deleted-assembly-workbook");

  await invokeHandler(sendHandler, req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(sendCount, 0);
});

test("email endpoint reports provider rejection without claiming success", async () => {
  const sendHandler = createSendLpaEmailHandler({
    sendMailFn: async to => ({ accepted: [to[0]], rejected: [to[1]], responseCode: 550 }),
    getLpaRecord: async () => ({
      section: "cc",
      sheets: [{ rows: [{ value: 1 }] }, { rows: [{ value: 1 }] }]
    }),
    getPdcaRecord: async id => ({ id, sheet: { rows: [{ observation: "Saved observation" }] } }),
    attemptStore: new Map(),
    portalBaseUrl: "https://portal.example"
  });
  const { req, res } = makeRequestResponse({
    to: ["one@example.com", "two@example.com"],
    cc: [],
    subject: "Selected CMS sheets",
    assemblySheet: { workbookId: "book-1", sheetIndex: 1, section: "cc" },
    pdcaSheet: { id: "PDCA-LPA-1", source: "lpa", section: "cc" }
  }, "request-rejected");
  await invokeHandler(sendHandler, req, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.responseBody.success, false);
  assert.deepEqual(res.responseBody.data.rejected, ["two@example.com"]);
});

test("received email follows exact layout structure: Header -> LPA Sheet Link -> Details Table -> PDCA Link -> Metrics (In-Progress, Done, Delay, Not-Started)", () => {
  const { html, assemblyUrl, pdcaUrl } = __emailTestUtils.buildSheetEmail(
    {
      workbookId: "book-assembly-101",
      sheetIndex: 0,
      section: "assembly",
      name: "Assembly",
      unit: "Bawal",
      auditor: "Joy Dastidar (ST080014)",
      score: "Level 3 - 1%",
      department: "Assembly",
      sectionName: "assembly",
      line: "-"
    },
    {
      id: "PDCA-LPA-ASY-Bawal",
      source: "lpa",
      section: "assembly"
    },
    "https://portal.example",
    "",
    {
      pdcaMetrics: {
        inProgress: 1,
        done: 0,
        delay: 0,
        notStarted: 9
      }
    }
  );

  // 1. Header
  const headerDearSirIdx = html.indexOf("Dear Sir,");
  const headerSafetyFirstIdx = html.indexOf("Safety First");
  assert.ok(headerDearSirIdx !== -1, "Should have 'Dear Sir,'");
  assert.ok(headerSafetyFirstIdx > headerDearSirIdx, "'Safety First' should follow 'Dear Sir,'");

  // 2. LPA Assembly Sheet link on same line as 'Click here to open'
  assert.match(html, /<strong>LPA Assembly Sheet: Assembly<\/strong> &mdash; <a [^>]*>Click here to open<\/a>/);
  const assemblyLinkIdx = html.indexOf("LPA Assembly Sheet: Assembly");
  assert.ok(assemblyLinkIdx > headerSafetyFirstIdx, "LPA Sheet Link should follow Safety First");

  // 3. Sheet Details Table with exact columns and values
  assert.match(html, /<th[^>]*>UNIT<\/th>/);
  assert.match(html, /<th[^>]*>AUDITOR NAME<\/th>/);
  assert.match(html, /<th[^>]*>SCORE<\/th>/);
  assert.match(html, /<th[^>]*>DEPARTMENT<\/th>/);
  assert.match(html, /<th[^>]*>SECTION<\/th>/);
  assert.match(html, /<th[^>]*>LINE<\/th>/);
  assert.match(html, /Bawal/);
  assert.match(html, /Joy Dastidar \(ST080014\)/);
  assert.match(html, /Level 3 - /);
  assert.match(html, /1%/);
  assert.match(html, />Assembly</);
  assert.match(html, />assembly</);
  const detailsTableIdx = html.indexOf("<table");
  assert.ok(detailsTableIdx > assemblyLinkIdx, "Details table should be directly below LPA Sheet Link");

  // 4. LPA Observation PDCA Link on same line as 'Click here to open'
  assert.match(html, /<strong>LPA Observation Assembly PDCA<\/strong> &mdash; <a [^>]*>Click here to open<\/a>/);
  const pdcaLinkIdx = html.indexOf("LPA Observation Assembly PDCA");
  assert.ok(pdcaLinkIdx > detailsTableIdx, "PDCA link should be below Details table");

  // 5. Metrics row below PDCA link (In-Progress, Done, Delay, Not-Started)
  assert.match(html, /METRICS:/);
  assert.match(html, /In-Progress/);
  assert.match(html, /Done/);
  assert.match(html, /Delay/);
  assert.match(html, /Not-Started/);
  const metricsIdx = html.indexOf("METRICS:");
  assert.ok(metricsIdx > pdcaLinkIdx, "Metrics should be below PDCA link");

  // Points list/summary must be removed
  assert.doesNotMatch(html, /<ol>/);
  assert.doesNotMatch(html, /Enlarge terminal/);
});

test("received email dynamically supports C&C Sheet, PDCA links and metrics badges", () => {
  const { html } = __emailTestUtils.buildSheetEmail(
    {
      workbookId: "book-cc-202",
      sheetIndex: 0,
      section: "cc",
      name: "C&C",
      unit: "Bawal",
      auditor: "Joy Dastidar (ST080014)",
      score: "Level 3 - 5%",
      department: "C&C",
      sectionName: "cc",
      line: "Line-1"
    },
    {
      id: "PDCA-LPA-CC-Bawal",
      source: "lpa",
      section: "cc"
    },
    "https://portal.example",
    "",
    {
      pdcaMetrics: {
        inProgress: 3,
        done: 5,
        delay: 1,
        notStarted: 12
      }
    }
  );

  assert.match(html, /<strong>LPA C(&amp;|&)C Sheet: C(&amp;|&)C<\/strong> &mdash; <a [^>]*>Click here to open<\/a>/);
  assert.match(html, /<strong>LPA Observation C(&amp;|&)C PDCA<\/strong> &mdash; <a [^>]*>Click here to open<\/a>/);
  assert.match(html, /METRICS:/);
  assert.match(html, /In-Progress/);
  assert.match(html, />3<\/span>/);
  assert.match(html, />5<\/span>/);
  assert.match(html, />1<\/span>/);
  assert.match(html, />12<\/span>/);
});

