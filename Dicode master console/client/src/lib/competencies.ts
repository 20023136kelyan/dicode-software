export type SkillDefinition = {
  id: string;
  name: string;
  description: string;
};

export type CompetencyDefinition = {
  id: string;
  name: string;
  description: string;
  skills: SkillDefinition[];
};

export const COMPETENCIES: CompetencyDefinition[] = [
  {
    id: 'psychological-safety',
    name: 'Foster Psychological Safety',
    description: 'Create an environment in which employees are free to be and express themselves without fear of negative consequences.',
    skills: [
      { id: 'ps-1', name: 'Mitigate Bias', description: 'Acknowledge bias in human cognition and act to reduce its negative impact.' },
      { id: 'ps-2', name: 'Practice Curiosity', description: 'Actively seek to understand needs and perspectives with a learning mindset.' },
      { id: 'ps-3', name: 'Seek Input', description: 'Begin decision-making by seeking advice, including from those unlikely to be heard.' },
      { id: 'ps-4', name: 'Manage Power', description: 'Recognize power dynamics and use influence responsibly to create opportunities.' },
    ],
  },
  {
    id: 'prosocial-norms',
    name: 'Establish Prosocial Norms',
    description: 'Demonstrate and reinforce behaviors that yield the best outcomes for the group versus the individual.',
    skills: [
      { id: 'pn-1', name: 'Value Diversity', description: 'Appreciate and leverage unique perspectives and skills of each team member.' },
      { id: 'pn-2', name: 'Show Appreciation', description: 'Regularly acknowledge and celebrate contributions in an equitable way.' },
      { id: 'pn-3', name: 'Ensure Equity', description: 'Insist on fair processes and outcomes, identifying barriers and providing resources.' },
      { id: 'pn-4', name: 'Build Relationships', description: 'Foster genuine connections based on mutual respect independent of organizational needs.' },
    ],
  },
  {
    id: 'collaboration',
    name: 'Encourage Collaboration',
    description: 'Foster trusting relationships based on mutual understanding that leads to improved collaboration towards shared goals.',
    skills: [
      { id: 'co-1', name: 'Demonstrate Empathy', description: 'Experience genuine concern for others’ feelings and validate their perspectives.' },
      { id: 'co-2', name: 'Recognize Strengths', description: 'Discover and amplify unique talents, creating opportunities to apply them.' },
      { id: 'co-3', name: 'Share Decision-making', description: 'Involve team members in decisions, especially those that impact them directly.' },
      { id: 'co-4', name: 'Promote Allyship', description: 'Recognize support among members and create opportunities for those structurally blocked.' },
    ],
  },
  {
    id: 'growth',
    name: 'Prioritize Growth',
    description: 'Make individual and group development a priority, treat failure as a learning opportunity, and lead with a learning mindset.',
    skills: [
      { id: 'gr-1', name: 'Confer Autonomy', description: 'Empower team members to take ownership and make decisions in their areas.' },
      { id: 'gr-2', name: 'Prioritize Learning', description: 'Foster a growth mindset, encouraging continuous learning and viewing mistakes as lessons.' },
      { id: 'gr-3', name: 'Embrace Change', description: 'Advocate for new ideas and approaches, encouraging innovation and adaptability.' },
      { id: 'gr-4', name: 'Welcome Feedback', description: 'Actively seek input on leadership style and inclusive practices, and act on it visibly.' },
    ],
  },
];

export const getCompetencyById = (id: string) =>
  COMPETENCIES.find((competency) => competency.id === id);

export const getSkillById = (competencyId: string, skillId: string) => {
  const competency = getCompetencyById(competencyId);
  return competency?.skills.find((skill) => skill.id === skillId);
};

export const buildTagList = (
  competencyIds: string[],
  selectedSkills: Record<string, string[]>,
): string[] => {
  const tags = new Set<string>();

  competencyIds.forEach((competencyId) => {
    const competency = getCompetencyById(competencyId);
    if (!competency) return;
    tags.add(competency.name);

    const skills = selectedSkills[competencyId] || [];
    skills.forEach((skillId) => {
      const skill = competency.skills.find((entry) => entry.id === skillId);
      if (skill) {
        tags.add(skill.name);
      }
    });
  });

  return Array.from(tags);
};
