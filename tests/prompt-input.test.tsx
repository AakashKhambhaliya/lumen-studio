// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { PromptInput } from "@/components/studio/PromptInput";
import type { MentionAsset } from "@/lib/catalog/mentions";

afterEach(cleanup);

const assets: MentionAsset[] = [
  { kind: "image", index: 1, url: "https://cdn.test/a.png", tag: "@image1" },
  { kind: "image", index: 2, url: "https://cdn.test/b.png", tag: "@image2" },
];

function Harness() {
  const [value, setValue] = useState("");
  return (
    <PromptInput
      value={value}
      onChange={setValue}
      onSubmit={() => {}}
      placeholder="Prompt"
      syntax={{ format: "at", kinds: ["image"] }}
      assets={assets}
    />
  );
}

describe("PromptInput tagging", () => {
  it("opens the asset list on @ and inserts the chosen tag", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const prompt = screen.getByRole("combobox", { name: "Prompt" });

    await user.type(prompt, "The warrior in @ima");
    expect(screen.getByRole("listbox", { name: "Attached media" })).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");

    expect((prompt as HTMLTextAreaElement).value).toBe("The warrior in @image2 ");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("inserts a tag from the chip row and warns about unknown tags", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const prompt = screen.getByRole("combobox", { name: "Prompt" });

    await user.type(prompt, "Hero @image3");
    expect(screen.getByRole("status").textContent).toContain("@image3");
    await user.click(screen.getByRole("button", { name: "@image1" }));
    expect((prompt as HTMLTextAreaElement).value).toBe("Hero @image3 @image1 ");
  });
});
