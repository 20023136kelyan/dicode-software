'use client';

import { useEffect, useState, useRef } from 'react';
import { getProgressStream, getGenerationResult } from '@/lib/api';
import { ProgressEvent, GenerationResult } from '@/lib/types';

interface ProgressDisplayProps {
  taskId: string | null;
  onComplete: (result: GenerationResult) => void;
  onProgressUpdate?: (progress: { [key: number]: number }) => void;
}

export default function ProgressDisplay({ taskId, onComplete, onProgressUpdate }: ProgressDisplayProps) {
  const [progress, setProgress] = useState<{ [key: number]: number }>({});
  const [messages, setMessages] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const isDoneRef = useRef(false); // Use ref to persist across renders

  useEffect(() => {
    // Reset state for new task
    setProgress({});
    setMessages([]);
    setIsComplete(false);
    isDoneRef.current = false;

    if (!taskId) {
      return;
    }

    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let hasReceivedSSE = false;

    console.log('🎬 Starting new generation tracking for task:', taskId);

    // Polling fallback when SSE fails
    const startPolling = () => {
      console.log('🔄 Starting polling fallback (SSE failed)');

      pollInterval = setInterval(async () => {
        if (isDoneRef.current) {
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        try {
          const result = await getGenerationResult(taskId);
          console.log('📊 Poll result:', result);

          if (result.status === 'completed' || result.sequence_id) {
            console.log('✅ Generation complete via polling');
            isDoneRef.current = true;
            onComplete(result);
            setIsComplete(true);
            if (pollInterval) clearInterval(pollInterval);
          } else if (result.status === 'error') {
            console.log('❌ Generation failed');
            isDoneRef.current = true;
            if (pollInterval) clearInterval(pollInterval);
          }
        } catch (err) {
          console.error('❌ Polling error:', err);
        }
      }, 2000); // Poll every 2 seconds
    };

    const connectSSE = () => {
      if (isDoneRef.current) {
        console.log('⏹️ Already completed, skipping SSE connection');
        return;
      }

      try {
        console.log('🔌 Connecting to SSE stream for task:', taskId);
        eventSource = getProgressStream(taskId);

        eventSource.onmessage = (event) => {
          try {
            const data: ProgressEvent = JSON.parse(event.data);
            console.log('📨 SSE message received:', data.type, data);
            hasReceivedSSE = true;

            if (data.type === 'shot_start') {
              setMessages((prev) => [...prev, `Starting Shot ${data.shot_number}...`]);
            } else if (data.type === 'progress' && data.shot_number !== undefined) {
              setProgress((prev) => {
                const newProgress = {
                  ...prev,
                  [data.shot_number!]: data.progress || 0,
                };
                // Notify JobTracker of progress update
                onProgressUpdate?.(newProgress);
                return newProgress;
              });
            } else if (data.type === 'shot_complete') {
              setMessages((prev) => [...prev, `Shot ${data.shot_number} complete!`]);
              setProgress((prev) => {
                const newProgress = {
                  ...prev,
                  [data.shot_number!]: 100,
                };
                // Notify JobTracker of progress update
                onProgressUpdate?.(newProgress);
                return newProgress;
              });
            } else if (data.type === 'complete' && data.result) {
              console.log('✅ Received completion message via SSE');
              setMessages((prev) => [...prev, 'All shots complete!']);
              setIsComplete(true);
              isDoneRef.current = true;
              onComplete(data.result);
              eventSource?.close();
              if (pollInterval) clearInterval(pollInterval);
            } else if (data.type === 'error') {
              console.log('❌ Received error message via SSE:', data.error);

              // If task not found or already completed, check for final result
              if (data.error && (data.error.includes('not found') || data.error.includes('already completed'))) {
                console.log('🔄 Task completed or not found, checking final result');
                eventSource?.close();
                if (pollInterval) clearInterval(pollInterval);

                // Check for final result
                getGenerationResult(taskId).then(result => {
                  if (result.status === 'completed' || result.sequence_id) {
                    console.log('✅ Found completed result');
                    isDoneRef.current = true;
                    onComplete(result);
                    setIsComplete(true);
                  } else {
                    console.log('⏳ Not complete yet, starting polling');
                    startPolling();
                  }
                }).catch(err => {
                  console.error('Failed to get final result:', err);
                  // Start polling as fallback
                  startPolling();
                });
              } else {
                // Real error
                setMessages((prev) => [...prev, `Error: ${data.error || 'Unknown error'}`]);
                isDoneRef.current = true;
                eventSource?.close();
                if (pollInterval) clearInterval(pollInterval);
              }
            }
          } catch (err) {
            console.error('Error parsing SSE message:', err);
          }
        };

        eventSource.onerror = async (error) => {
          console.log('❌ SSE connection error - switching to polling mode');

          // Close the event source to stop automatic reconnection
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          // If we're already done, don't fetch again
          if (isDoneRef.current) {
            console.log('⏹️ Already marked as done, skipping fallback');
            return;
          }

          // Start polling if we haven't received any SSE messages
          if (!hasReceivedSSE) {
            startPolling();
          } else {
            // If we were receiving SSE but it disconnected, try one final check
            try {
              const result = await getGenerationResult(taskId);
              console.log('📦 Final check result:', result);

              if (result.status === 'completed' || result.status === 'complete' || result.sequence_id) {
                console.log('✅ Generation complete');
                isDoneRef.current = true;
                onComplete(result);
                setIsComplete(true);
              } else {
                // Not complete yet, start polling
                startPolling();
              }
            } catch (err) {
              console.error('❌ Failed to fetch result:', err);
              // Start polling anyway
              startPolling();
            }
          }
        };
      } catch (err) {
        console.error('Failed to connect to SSE:', err);
      }
    };

    connectSSE();

    return () => {
      console.log('🧹 Cleaning up SSE connection and polling');
      isDoneRef.current = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, [taskId, onComplete]);

  if (!taskId) return null;

  return (
    <div className="card rounded-2xl p-6 mb-6 animate-fadeIn">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-lg font-semibold text-gray-200">Generating Videos</h2>
      </div>

      {Object.entries(progress).map(([shotNumber, percent]) => (
        <div key={shotNumber} className="mb-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300 font-medium">Shot {shotNumber}</span>
            <span className="text-sky-400 font-semibold">{percent}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/10">
            <div
              className="bg-sky-500 h-2.5 rounded-full transition-all duration-500 shadow-lg shadow-sky-500/50"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ))}

      <div className="mt-5 space-y-2 max-h-60 overflow-y-auto">
        {messages.map((msg, index) => (
          <div key={index} className="text-xs text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 animate-fadeIn">
            {msg}
          </div>
        ))}
      </div>

      {isComplete && (
        <div className="mt-5 p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <span className="text-lg">✓</span>
            </div>
            <p className="text-sm text-emerald-300 font-medium">Generation complete! Check results below.</p>
          </div>
        </div>
      )}
    </div>
  );
}
