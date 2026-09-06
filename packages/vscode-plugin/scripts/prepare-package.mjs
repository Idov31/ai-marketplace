import { copyFile, mkdir } from "node:fs/promises";

await mkdir("media", { recursive: true });
await mkdir("schemas", { recursive: true });
for (const file of ["ai-marketplace-sidebar.svg", "ai-marketplace-transparent.png", "ai-marketplace.png"]) {
  await copyFile(`../../media/${file}`, `media/${file}`);
}
for (const file of ["README.md", "CHANGELOG.md", "LICENSE"]) {
  await copyFile(`../../${file}`, file);
}
await copyFile("../../schemas/ai_marketplace.schema.json", "schemas/ai_marketplace.schema.json");
