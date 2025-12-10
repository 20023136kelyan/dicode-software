import React from 'react';
import { motion } from 'framer-motion';
import Card from '../shared/Card';

interface Skill {
  name: string;
  score: number; // 0-100
  color?: string;
}

interface SkillBreakdownProps {
  skills: Skill[];
  title?: string;
  className?: string;
}

const SkillBreakdown: React.FC<SkillBreakdownProps> = ({
  skills,
  title = 'Skill Breakdown',
  className = '',
}) => {
  const getBarColor = (score: number, customColor?: string) => {
    if (customColor) return customColor;
    if (score >= 80) return 'bg-success';
    if (score >= 60) return 'bg-primary';
    if (score >= 40) return 'bg-accent';
    return 'bg-streak';
  };

  return (
    <Card className={className}>
      <h3 className="font-semibold text-light-text mb-4">{title}</h3>
      <div className="space-y-4">
        {skills.map((skill, index) => (
          <div key={skill.name}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm text-light-text">{skill.name}</span>
              <span className="text-sm font-medium text-light-text-secondary">
                {skill.score}%
              </span>
            </div>
            <div className="h-2.5 bg-light-border rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${getBarColor(skill.score, skill.color)}`}
                initial={{ width: 0 }}
                animate={{ width: `${skill.score}%` }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default SkillBreakdown;
