import { CompetencyScore, EmployeeProgress, DepartmentAnalytics } from '@/types';

// Generate mock time series data
export const generateTimeSeriesData = (): CompetencyScore[] => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Oct', 'Nov', 'Dec'];
  return months.map((month, index) => ({
    date: month,
    overallScore: 70 + Math.sin(index * 0.5) * 5,
    psychologicalSafety: 75 - index * 2 + Math.random() * 5,
    prosocialNorms: 68 - index * 1.5 + Math.random() * 3,
    collaboration: 65 - index * 0.5 + Math.random() * 3,
    growth: 72 - index * 1 + Math.random() * 4,
  }));
};

// Psychological Safety detail data
export const psychologicalSafetyData = [
  {
    date: 'Jan',
    overall: 75,
    empathy: 78,
    strengths: 76,
    allyship: 74,
    decisionMaking: 73,
  },
  {
    date: 'Feb',
    overall: 74,
    empathy: 77,
    strengths: 75,
    allyship: 73,
    decisionMaking: 72,
  },
  {
    date: 'Mar',
    overall: 73,
    empathy: 76,
    strengths: 74,
    allyship: 72,
    decisionMaking: 71,
  },
  {
    date: 'Apr',
    overall: 72,
    empathy: 75,
    strengths: 73,
    allyship: 71,
    decisionMaking: 70,
  },
  {
    date: 'May',
    overall: 55,
    empathy: 58,
    strengths: 56,
    allyship: 54,
    decisionMaking: 52,
  },
  {
    date: 'Jun',
    overall: 54,
    empathy: 57,
    strengths: 55,
    allyship: 53,
    decisionMaking: 51,
  },
  {
    date: 'Jul',
    overall: 53,
    empathy: 56,
    strengths: 54,
    allyship: 52,
    decisionMaking: 50,
  },
  {
    date: 'Aug',
    overall: 52,
    empathy: 55,
    strengths: 53,
    allyship: 51,
    decisionMaking: 49,
  },
  {
    date: 'Oct',
    overall: 51,
    empathy: 54,
    strengths: 52,
    allyship: 50,
    decisionMaking: 48,
  },
  {
    date: 'Nov',
    overall: 50,
    empathy: 53,
    strengths: 51,
    allyship: 49,
    decisionMaking: 47,
  },
  {
    date: 'Dec',
    overall: 49,
    empathy: 52,
    strengths: 50,
    allyship: 48,
    decisionMaking: 46,
  },
];

export const mockEmployeeProgress: EmployeeProgress[] = [
  {
    employeeId: '1',
    employeeName: 'Sarah Johnson',
    department: 'Marketing',
    completedModules: 8,
    totalModules: 10,
    averageScore: 85,
    lastActivity: new Date('2024-01-15'),
    engagementLevel: 'high',
  },
  {
    employeeId: '2',
    employeeName: 'Mike Chen',
    department: 'Technology',
    completedModules: 5,
    totalModules: 10,
    averageScore: 72,
    lastActivity: new Date('2024-01-10'),
    engagementLevel: 'medium',
  },
  {
    employeeId: '3',
    employeeName: 'Emily Davis',
    department: 'Operations',
    completedModules: 9,
    totalModules: 10,
    averageScore: 91,
    lastActivity: new Date('2024-01-18'),
    engagementLevel: 'high',
  },
];

export const mockDepartmentAnalytics: DepartmentAnalytics[] = [
  {
    department: 'Marketing',
    employeeCount: 45,
    averageCompletionRate: 85,
    averageScore: 82,
    topCompetencies: ['Collaboration', 'Growth'],
    improvementAreas: ['Psychological Safety'],
  },
  {
    department: 'Technology',
    employeeCount: 67,
    averageCompletionRate: 65,
    averageScore: 71,
    topCompetencies: ['Prosocial Norms'],
    improvementAreas: ['Psychological Safety', 'Collaboration'],
  },
  {
    department: 'Operations',
    employeeCount: 38,
    averageCompletionRate: 78,
    averageScore: 79,
    topCompetencies: ['Collaboration'],
    improvementAreas: ['Growth'],
  },
];
