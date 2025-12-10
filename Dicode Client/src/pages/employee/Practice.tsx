import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RotateCcw,
  Target,
  PlayCircle,
  BookOpen,
  Brain,
  Clock,
  Zap,
  ChevronRight,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserEnrollments, getCampaign, getUserStats } from '@/lib/firestore';
import {
  Card,
  Button,
  SectionHeader,
  Skeleton,
  ProgressRing,
} from '@/components/mobile';

interface PracticeOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  onClick: () => void;
  disabled?: boolean;
}

interface WeakArea {
  skill: string;
  score: number;
  exercises: number;
}

const Practice: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [completedModules, setCompletedModules] = useState(0);
  const [totalModules, setTotalModules] = useState(0);
  const [mistakesToReview, setMistakesToReview] = useState(12); // Mock
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const enrollments = await getUserEnrollments(user.id);
        const stats = await getUserStats(user.id);

        const completed = enrollments.filter(e => e.status === 'completed').length;
        setCompletedModules(completed);
        setTotalModules(enrollments.length);

        // Mock weak areas based on skill profile
        setWeakAreas([
          { skill: 'Active Listening', score: 45, exercises: 3 },
          { skill: 'Feedback', score: 52, exercises: 2 },
          { skill: 'Collaboration', score: 58, exercises: 4 },
        ]);
      } catch (error) {
        console.error('[Practice] Failed to load stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [user]);

  const practiceOptions: PracticeOption[] = [
    {
      id: 'mistakes',
      title: 'Review Mistakes',
      description: 'Revisit questions you missed',
      icon: <RotateCcw size={20} className="text-error" />,
      badge: `${mistakesToReview} items`,
      onClick: () => navigate('/employee/practice/review'),
    },
    {
      id: 'quick',
      title: 'Quick Practice',
      description: 'Random questions from past modules',
      icon: <Zap size={20} className="text-accent" />,
      badge: '~5 min',
      onClick: () => navigate('/employee/practice/quick'),
    },
    {
      id: 'rewatch',
      title: 'Rewatch Videos',
      description: 'Browse completed modules',
      icon: <PlayCircle size={20} className="text-primary" />,
      badge: `${completedModules} videos`,
      onClick: () => navigate('/employee/learn'),
    },
    {
      id: 'weak',
      title: 'Weak Areas',
      description: 'Focus on your lowest skills',
      icon: <Target size={20} className="text-warning" />,
      badge: `${weakAreas.reduce((sum, w) => sum + w.exercises, 0)} exercises`,
      onClick: () => navigate('/employee/practice/weak'),
      disabled: weakAreas.length === 0,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  } as const;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-light-bg">
        <div className="sticky top-0 z-10 bg-light-bg/95 backdrop-blur-sm border-b border-light-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft size={20} className="text-light-text" />
            </button>
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-light-bg/95 backdrop-blur-sm border-b border-light-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-light-border/50 transition-colors"
          >
            <ArrowLeft size={20} className="text-light-text" />
          </button>
          <h1 className="font-semibold text-light-text">Practice</h1>
        </div>
      </div>

      <motion.div
        className="p-4 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Progress Summary */}
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <div className="flex items-center gap-4">
              <ProgressRing
                progress={totalModules > 0 ? (completedModules / totalModules) * 100 : 0}
                size={60}
                strokeWidth={6}
                showPercentage={false}
              >
                <Brain size={24} className="text-primary" />
              </ProgressRing>
              <div className="flex-1">
                <h3 className="font-semibold text-light-text">Your Progress</h3>
                <p className="text-sm text-light-text-secondary">
                  {completedModules} of {totalModules} modules completed
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <TrendingUp size={14} className="text-success" />
                  <span className="text-xs text-success">Keep it up!</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Practice Options */}
        <motion.div variants={itemVariants} className="space-y-3">
          <SectionHeader title="Review Options" />
          {practiceOptions.map((option, index) => (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                interactive={!option.disabled}
                onClick={option.disabled ? undefined : option.onClick}
                className={option.disabled ? 'opacity-50' : ''}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-light-border/50 flex items-center justify-center flex-shrink-0">
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-light-text">{option.title}</h4>
                      {option.badge && (
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-light-text-muted mt-0.5">
                      {option.description}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-light-text-muted flex-shrink-0" />
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Weak Areas */}
        {weakAreas.length > 0 && (
          <motion.div variants={itemVariants} className="space-y-3">
            <SectionHeader
              title="Areas to Improve"
              action={{
                label: 'Practice All',
                onClick: () => navigate('/employee/practice/weak'),
              }}
            />
            <Card>
              <div className="space-y-4">
                {weakAreas.map((area, index) => (
                  <motion.div
                    key={area.skill}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-light-text">
                          {area.skill}
                        </span>
                        <span className="text-xs text-light-text-muted">
                          {area.score}%
                        </span>
                      </div>
                      <div className="h-2 bg-light-border rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-warning rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${area.score}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/employee/practice/skill/${area.skill}`)}
                      className="px-3 py-1 text-xs font-medium text-warning bg-warning/10 rounded-full hover:bg-warning/20 transition-colors"
                    >
                      {area.exercises} exercises
                    </button>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Daily Challenge */}
        <motion.div variants={itemVariants}>
          <Card
            interactive
            onClick={() => navigate('/employee/practice/challenge')}
            className="bg-gradient-to-br from-accent/10 to-primary/10 border-accent/20"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                <Trophy size={20} className="text-accent" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-light-text">Daily Challenge</h4>
                <p className="text-sm text-light-text-secondary">
                  Complete 5 questions for bonus XP
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-accent">+50</span>
                <p className="text-xs text-light-text-muted">XP</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Tips */}
        <motion.div variants={itemVariants}>
          <Card className="bg-light-border/30">
            <div className="flex items-start gap-3">
              <BookOpen size={18} className="text-light-text-muted mt-0.5" />
              <div>
                <p className="text-sm text-light-text-secondary leading-relaxed">
                  <span className="font-medium text-light-text">Pro tip:</span> Practicing
                  weak areas regularly can boost your overall score by up to 20%.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Practice;
