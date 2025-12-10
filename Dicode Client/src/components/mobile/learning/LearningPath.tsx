import React from 'react';
import { motion } from 'framer-motion';
import PathNode, { PathNodeStatus } from './PathNode';

export interface PathNodeData {
  id: string;
  title: string;
  subtitle?: string;
  status: PathNodeStatus;
  progress?: number;
  campaignId?: string;
  moduleIndex?: number;
}

interface LearningPathProps {
  nodes: PathNodeData[];
  onNodeClick?: (node: PathNodeData) => void;
  className?: string;
}

const LearningPath: React.FC<LearningPathProps> = ({
  nodes,
  onNodeClick,
  className = '',
}) => {
  // Zigzag pattern offsets for visual interest
  const getHorizontalOffset = (index: number): string => {
    const pattern = [0, 30, 0, -30]; // pixels from center
    return `${pattern[index % 4]}px`;
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {nodes.map((node, index) => (
        <React.Fragment key={node.id}>
          {/* Connecting Line */}
          {index > 0 && (
            <motion.div
              className={`
                w-1 h-10 rounded-full
                ${nodes[index - 1].status === 'completed' && node.status !== 'locked'
                  ? 'bg-success'
                  : node.status === 'locked'
                  ? 'bg-light-border'
                  : 'bg-primary/30'
                }
              `}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              style={{
                marginLeft: getHorizontalOffset(index),
              }}
            />
          )}

          {/* Node */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.1 }}
            style={{
              marginLeft: getHorizontalOffset(index),
            }}
          >
            <PathNode
              status={node.status}
              title={node.title}
              subtitle={node.subtitle}
              progress={node.progress}
              onClick={() => onNodeClick?.(node)}
              size={node.status === 'current' ? 'lg' : 'md'}
            />
          </motion.div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default LearningPath;
