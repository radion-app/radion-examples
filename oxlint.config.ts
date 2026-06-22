import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

// Type-aware rules are off and `any` is allowed for decoded frame payloads:
// these examples handle dynamic onchain JSON, so payload fields have no static
// type. Tighten both once the example payloads are given concrete types.
export default defineConfig({
  extends: [core],
  rules: {
    "typescript/no-explicit-any": "off",
  },
});
