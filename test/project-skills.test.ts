import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  findProjectSkillByName,
  readProjectSkillDocument
} from "../src/lib/project-skills.js";

describe("project-skills", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((temporaryDirectory) =>
        rm(temporaryDirectory, { recursive: true, force: true })
      )
    );
  });

  it("finds a project skill by exact name", () => {
    const projectSkill = findProjectSkillByName(
      {
        projectSkills: [
          {
            name: "alpha",
            targetPath: "/skills/alpha",
            skillMdPath: "/skills/alpha/SKILL.md",
            relativePath: ".golutra/skills/alpha/SKILL.md"
          }
        ]
      },
      "alpha"
    );

    expect(projectSkill.skillMdPath).toBe("/skills/alpha/SKILL.md");
  });

  it("reads the discovered SKILL.md content", async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "golutra-mcp-skill-"));
    temporaryDirectories.push(temporaryDirectory);
    const skillMdPath = path.join(temporaryDirectory, "SKILL.md");
    await writeFile(skillMdPath, "# Test Skill\n", "utf8");

    const document = await readProjectSkillDocument({
      name: "test-skill",
      targetPath: temporaryDirectory,
      skillMdPath,
      relativePath: ".golutra/skills/test-skill/SKILL.md"
    });

    expect(document.content).toBe("# Test Skill\n");
  });

  it("reports available skill names when a project skill is missing", () => {
    expect(() =>
      findProjectSkillByName(
        {
          projectSkills: [
            {
              name: "alpha",
              targetPath: "/skills/alpha",
              skillMdPath: "/skills/alpha/SKILL.md",
              relativePath: ".golutra/skills/alpha/SKILL.md"
            },
            {
              name: "beta",
              targetPath: "/skills/beta",
              skillMdPath: "/skills/beta/SKILL.md",
              relativePath: ".golutra/skills/beta/SKILL.md"
            }
          ]
        },
        "gamma"
      )
    ).toThrow(/alpha, beta/);
  });
});
