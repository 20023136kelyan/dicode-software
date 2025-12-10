import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area';
  data: Record<string, any>[];
  xKey?: string;
  yKey?: string | string[];
  title?: string;
  colors?: string[];
}

const CHART_COLORS = ['#F5A623', '#8B5CF6', '#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#EC4899'];

const ChartRenderer: React.FC<{ config: ChartData }> = ({ config }) => {
  const { type, data, xKey = 'name', yKey = 'value', title, colors = CHART_COLORS } = config;

  const yKeys = Array.isArray(yKey) ? yKey : [yKey];

  return (
    <div className="my-4 p-4 bg-dark-bg rounded-xl border border-dark-border">
      {title && <h4 className="text-sm font-medium text-dark-text mb-3">{title}</h4>}
      <ResponsiveContainer width="100%" height={300}>
        {type === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xKey} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xKey} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length] }}
              />
            ))}
          </LineChart>
        ) : type === 'area' ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xKey} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
            />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

const CodeBlock: React.FC<{
  language: string | undefined;
  children: string;
}> = ({ language, children }) => {
  const [copied, setCopied] = React.useState(false);

  // Check if this is a chart code block
  if (language === 'chart') {
    try {
      const chartConfig = JSON.parse(children) as ChartData;
      return <ChartRenderer config={chartConfig} />;
    } catch (e) {
      console.error('Failed to parse chart config:', e);
      // Fall through to render as regular code
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-dark-card/80 text-dark-text-muted hover:text-dark-text transition opacity-0 group-hover:opacity-100"
          title="Copy code"
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '12px',
          fontSize: '13px',
          padding: '16px',
          background: '#1a1a2e',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const components = useMemo(
    () => ({
      // Code blocks
      code({ node, inline, className: codeClassName, children, ...props }: any) {
        const match = /language-(\w+)/.exec(codeClassName || '');
        const language = match ? match[1] : undefined;
        const codeString = String(children).replace(/\n$/, '');

        if (!inline && (language || codeString.includes('\n'))) {
          return <CodeBlock language={language} children={codeString} />;
        }

        return (
          <code
            className="px-1.5 py-0.5 rounded bg-dark-bg text-primary text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      },

      // Tables
      table({ children }: any) {
        return (
          <div className="my-4 overflow-x-auto rounded-xl border border-dark-border">
            <table className="w-full text-sm">{children}</table>
          </div>
        );
      },
      thead({ children }: any) {
        return <thead className="bg-dark-bg border-b border-dark-border">{children}</thead>;
      },
      tbody({ children }: any) {
        return <tbody className="divide-y divide-dark-border">{children}</tbody>;
      },
      tr({ children }: any) {
        return <tr className="hover:bg-dark-bg/50 transition">{children}</tr>;
      },
      th({ children }: any) {
        return (
          <th className="px-4 py-3 text-left font-semibold text-dark-text">{children}</th>
        );
      },
      td({ children }: any) {
        return <td className="px-4 py-3 text-dark-text-muted">{children}</td>;
      },

      // Headings
      h1({ children }: any) {
        return <h1 className="text-2xl font-bold text-dark-text mt-6 mb-3">{children}</h1>;
      },
      h2({ children }: any) {
        return <h2 className="text-xl font-bold text-dark-text mt-5 mb-2">{children}</h2>;
      },
      h3({ children }: any) {
        return <h3 className="text-lg font-semibold text-dark-text mt-4 mb-2">{children}</h3>;
      },
      h4({ children }: any) {
        return <h4 className="text-base font-semibold text-dark-text mt-3 mb-1">{children}</h4>;
      },

      // Paragraphs
      p({ children }: any) {
        return <p className="mb-3 last:mb-0">{children}</p>;
      },

      // Lists
      ul({ children }: any) {
        return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>;
      },
      ol({ children }: any) {
        return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>;
      },
      li({ children }: any) {
        return <li className="text-dark-text">{children}</li>;
      },

      // Links
      a({ href, children }: any) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {children}
          </a>
        );
      },

      // Blockquotes
      blockquote({ children }: any) {
        return (
          <blockquote className="border-l-4 border-primary pl-4 my-3 text-dark-text-muted italic">
            {children}
          </blockquote>
        );
      },

      // Horizontal rule
      hr() {
        return <hr className="my-4 border-dark-border" />;
      },

      // Bold/Strong
      strong({ children }: any) {
        return <strong className="font-semibold text-dark-text">{children}</strong>;
      },

      // Italic/Emphasis
      em({ children }: any) {
        return <em className="italic">{children}</em>;
      },
    }),
    []
  );

  return (
    <div className={`markdown-content text-dark-text leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

