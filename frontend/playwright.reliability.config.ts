import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
export default defineConfig({testDir:"validation",testMatch:"p3-fix-04.spec.ts",workers:1,timeout:60000,expect:{timeout:25000},reporter:"list",outputDir:mkdtempSync(join(tmpdir(),"govvote-p3fix04-")),use:{baseURL:"http://127.0.0.1:4174",browserName:"chromium"},webServer:{command:"node validation/fallback-server.mjs",url:"http://127.0.0.1:4174",reuseExistingServer:false}});
