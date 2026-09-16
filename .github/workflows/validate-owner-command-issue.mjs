#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const EXPECTED_SECTIONS = Object.freeze([
  "Owner-command form",
  "Action",
  "Target ticket",
  "Expected current hash",
  "Candidate OID",
  "Reason"
]);

export function validateOwnerCommandIssue({ title, body }) {
  const errors = [];
  if (typeof title !== "string" || !/^\[decision\] \S/.test(title)) errors.push("title must start with '[decision] ' and name a target");
  if (typeof body !== "string") return { ok: false, errors: [...errors, "body must be text"] };

  const sectionMatches = [...body.matchAll(/^### (.+)\r?$/gm)];
  const headings = sectionMatches.map((match) => match[1].trim());
  if (JSON.stringify(headings) !== JSON.stringify(EXPECTED_SECTIONS)) errors.push("body does not match the owner-decision/v1 section order");

  const markerIndex = sectionMatches.findIndex((match) => match[1].trim() === "Owner-command form");
  const markerBody = markerIndex === -1
    ? undefined
    : body.slice(sectionMatches[markerIndex].index + sectionMatches[markerIndex][0].length, sectionMatches[markerIndex + 1]?.index ?? body.length).trim();
  if (markerBody !== "owner-decision/v1") errors.push("owner-decision/v1 form marker is missing, changed, or contains extra content");
  return { ok: errors.length === 0, errors };
}

function main(argv = process.argv) {
  const bodyIndex = argv.indexOf("--body-file");
  if (bodyIndex === -1 || !argv[bodyIndex + 1]) throw new Error("usage: validate-owner-command-issue.mjs --body-file <path>");
  const result = validateOwnerCommandIssue({ title: process.env.ISSUE_TITLE, body: fs.readFileSync(argv[bodyIndex + 1], "utf8") });
  if (!result.ok) {
    for (const error of result.errors) console.error(`owner-command intake rejected: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("owner-command intake accepted: owner-decision/v1 form shape");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
