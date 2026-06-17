import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL ?? "https://localhost:3000";
const outputDir = process.env.SMOKE_OUTPUT_DIR ?? "/tmp/grove-smoke";

const routes = ["/", "/profile/mira", "/tip/mira"];
const apiRoutes = ["/api/public/x/miramakes"];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures: string[] = [];

for (const route of routes) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(2_000);

  const status = response?.status() ?? 0;
  const title = await page.title();
  await page.screenshot({
    path: `${outputDir}/${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}.png`,
    fullPage: true,
  });

  if (status < 200 || status >= 400) {
    failures.push(`${route} returned HTTP ${status}`);
  }
  if (title !== "Grove") {
    failures.push(`${route} title was ${JSON.stringify(title)}`);
  }
  if (errors.length) {
    failures.push(`${route} browser errors: ${errors.join(" | ")}`);
  }

  console.log(`${route} ${status} ${title}`);
  await page.close();
}

for (const route of apiRoutes) {
  const response = await fetch(`${baseUrl}${route}`);
  const body = (await response.json()) as { linked?: boolean };

  if (!response.ok) {
    failures.push(`${route} returned HTTP ${response.status}`);
  }
  if (body.linked !== true) {
    failures.push(`${route} did not return linked profile data`);
  }

  console.log(`${route} ${response.status} linked=${body.linked}`);
}

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
