import { readFile } from "node:fs/promises";

import type {
  ListSkillsResponse,
  ProjectSkillDescriptor
} from "./types.js";

export interface ProjectSkillDocument extends ProjectSkillDescriptor {
  content: string;
}

export function findProjectSkillByName(
  skillsResponse: ListSkillsResponse,
  skillName: string
): ProjectSkillDescriptor {
  const projectSkills = skillsResponse.projectSkills ?? [];
  if (projectSkills.length === 0) {
    throw new Error(
      "No project skills were found for this workspace. Run golutra-list-project-skills first to verify discovery."
    );
  }

  const matchedSkill = projectSkills.find((projectSkill) => projectSkill.name === skillName);
  if (!matchedSkill) {
    throw new Error(
      `Project skill "${skillName}" was not found. Available project skills: ${projectSkills
        .map((projectSkill) => projectSkill.name)
        .join(", ")}`
    );
  }

  return matchedSkill;
}

export async function readProjectSkillDocument(
  projectSkill: ProjectSkillDescriptor
): Promise<ProjectSkillDocument> {
  const content = await readFile(projectSkill.skillMdPath, "utf8");
  return {
    ...projectSkill,
    content
  };
}
