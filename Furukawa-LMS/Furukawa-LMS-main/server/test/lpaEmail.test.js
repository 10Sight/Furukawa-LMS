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
  assert.equal(sentSubject, "Assembly PDCA Sheet");
  assert.match(sentHtml, /sheet=pdca-9/);
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
    attemptStore: new Map(),
    portalBaseUrl: "https://portal.example"
  });
  const { req, res } = makeRequestResponse({
    to: ["one@example.com", "two@example.com"],
    cc: [],
    subject: "Selected CMS sheets",
    assemblySheet: { workbookId: "book-1", sheetIndex: 1 },
    pdcaSheet: { id: "lpa-pdca-1", source: "lpa", section: "cc" }
  }, "request-rejected");
  await invokeHandler(sendHandler, req, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.responseBody.success, false);
  assert.deepEqual(res.responseBody.data.rejected, ["two@example.com"]);
});
