import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders Bill's decision questions", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Booming Bookkeeping Performance Reports/i);
  assert.match(html, /Bill.*decision questions/i);
  assert.match(html, /What predicts a BBB purchase/i);
  assert.match(html, /Same-day VIP/i);
});

test("renders the complete July revenue page", async () => {
  const response = await render("/revenue");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Every payment collected during July/i);
  assert.match(html, /4,049,231/);
  assert.match(html, /No prior browser touchpoint/i);
});

test("renders the paid-click cohort and later purchases", async () => {
  const response = await render("/ads");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Revenue assigned back to July ads/i);
  assert.match(html, /2,786,701/);
  assert.match(html, /814,942/);
  assert.match(html, /Paid performance by ad/i);
});
