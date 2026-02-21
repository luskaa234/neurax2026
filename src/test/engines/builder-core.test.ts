import { describe, expect, it } from "vitest";
import { applyMergePlan } from "../../../packages/merge-engine/src";
import { runValidation } from "../../../packages/validator-engine/src";

describe("builder core engines", () => {
  it("applies merge plan", () => {
    const out = applyMergePlan(
      { "app/page.tsx": "export default function Page(){return null;}" },
      {
        create: [{ path: "app/test.ts", content: "export const x = 1;" }],
        update: [{ path: "app/page.tsx", content: "export default function Page(){return <div/>;}" }],
        dependencies: [],
        routes: [{ path: "/", file: "app/page.tsx" }],
      },
    );

    expect(out.files["app/test.ts"]).toContain("x = 1");
    expect(out.files["app/page.tsx"]).toContain("<div/>");
  });

  it("validates generated files", () => {
    const result = runValidation(
      {
        "package.json": JSON.stringify({ dependencies: { react: "18.3.1" } }),
        "app/page.tsx": "const x: any = 1; export default function Page(){ return <div>{x}</div>; }",
      },
      [{ path: "/", file: "app/page.tsx" }],
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.type === "type")).toBe(true);
  });
});
