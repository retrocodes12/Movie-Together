import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Hono } from "hono";
import { handle } from "hono/vercel";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(rootDir, "MovieTogether/apps/web/src/app/api");
const app = new Hono();

async function findRouteFiles(dir) {
  const entries = await readdir(dir);
  const routes = [];
  for (const entry of entries) {
    if (entry === "__create" || entry === "utils") continue;
    const filePath = path.join(dir, entry);
    const info = await stat(filePath);
    if (info.isDirectory()) {
      routes.push(...await findRouteFiles(filePath));
    } else if (entry === "route.js") {
      routes.push(filePath);
    }
  }
  return routes;
}

function toHonoPath(routeFile) {
  const relative = path.relative(apiDir, routeFile);
  const parts = relative.split(path.sep).slice(0, -1);
  const mapped = parts.map((part) => {
    const match = part.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (!match) return part;
    return match[1] ? `:${match[2]}{.+}` : `:${match[2]}`;
  });
  return `/api/${mapped.join("/")}`.replace(/\/$/, "");
}

async function registerRoutes() {
  if (!existsSync(apiDir)) {
    throw new Error(`API directory missing: ${apiDir}`);
  }
  const routeFiles = (await findRouteFiles(apiDir)).sort((a, b) => b.length - a.length);
  for (const routeFile of routeFiles) {
    const routeModule = await import(pathToFileURL(routeFile).href);
    const honoPath = toHonoPath(routeFile);
    for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
      if (!routeModule[method]) continue;
      app.on(method, honoPath, async (c) => {
        return routeModule[method](c.req.raw, { params: c.req.param() });
      });
    }
  }
}

await registerRoutes();

app.get("/join/:code", (c) => {
  const code = c.req.param("code");
  return c.html(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nuvio Watch Together Invite</title>
    <style>
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #080b10; color: #f4f7fb; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { max-width: 620px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 32px; background: rgba(255,255,255,.04); }
      p { color: #a6b0bd; line-height: 1.6; }
      code { color: #b8ffd7; background: rgba(96,211,148,.12); padding: 4px 8px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Nuvio Watch Together</h1>
        <p>Invite code: <code>${code}</code></p>
        <p>Open Nuvio, join Watch Together room, and enter this code.</p>
      </section>
    </main>
  </body>
</html>`);
});

app.get("*", (c) => {
  return c.html(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nuvio Watch Together API</title>
    <style>
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #080b10; color: #f4f7fb; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { max-width: 760px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 32px; background: rgba(255,255,255,.04); }
      p { color: #a6b0bd; line-height: 1.6; }
      code { color: #b8ffd7; background: rgba(96,211,148,.12); padding: 4px 8px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Nuvio Watch Together API</h1>
        <p>Backend live. Configure Nuvio with this origin as <code>WATCH_TOGETHER_API_BASE_URL</code>.</p>
        <p>Database status depends on <code>DATABASE_URL</code> being set in deployment environment.</p>
      </section>
    </main>
  </body>
</html>`);
});

export default handle(app);
