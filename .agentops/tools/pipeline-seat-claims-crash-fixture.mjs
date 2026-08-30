import fs from "node:fs";
import { commitClaimTransfer } from "./pipeline-seat-claims.mjs";

const file = process.argv[2];
if (!file) throw new Error("crash fixture requires one config path");
commitClaimTransfer(JSON.parse(fs.readFileSync(file, "utf8")));
throw new Error("hard-exit plant did not terminate the child");
