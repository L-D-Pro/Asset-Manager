import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

/**
 * Normalises the OpenAPI spec title to "Api" before code generation.
 *
 * Orval uses the API title as the base name for generated files and exports.
 * Forcing it to "Api" ensures the generated output is always `api.ts` regardless
 * of what title is set in `openapi.yaml`, keeping imports consistent.
 */
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

/**
 * Orval codegen configuration.
 *
 * Reads `openapi.yaml` in this directory and generates two workspace packages:
 *
 * - **api-client-react**: TanStack Query v5 hooks for the React dashboard.
 *   Uses a custom fetch mutator (`lib/api-client-react/src/custom-fetch.ts`)
 *   that reads `BASE_PATH` from the environment for Replit proxy-compatible URLs.
 *
 * - **zod**: Zod validation schemas for the API server.
 *   Auto-coerces query params, path params, and request bodies.
 *   Dates are parsed as JS `Date` objects; BigInts are preserved.
 *
 * Run: `pnpm --filter @workspace/api-spec run codegen`
 *
 * See `API_CONTRACT.md` in this directory for the full endpoint inventory and
 * detailed notes on the spec-first workflow.
 */
export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
