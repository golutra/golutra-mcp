import type { ListSkillsResponse, ProjectSkillDescriptor } from "./types.js";
export interface ProjectSkillDocument extends ProjectSkillDescriptor {
    content: string;
}
export declare function findProjectSkillByName(skillsResponse: ListSkillsResponse, skillName: string): ProjectSkillDescriptor;
export declare function readProjectSkillDocument(projectSkill: ProjectSkillDescriptor): Promise<ProjectSkillDocument>;
