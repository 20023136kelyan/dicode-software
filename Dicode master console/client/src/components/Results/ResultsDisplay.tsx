'use client';

import { GenerationResult } from '@/lib/types';
import { getDownloadUrl } from '@/lib/api';
import { FilmIcon } from '@heroicons/react/24/outline';

interface ResultsDisplayProps {
  result: GenerationResult | null;
}

export default function ResultsDisplay({ result }: ResultsDisplayProps) {
  if (!result || !result.sequence_id) return null;

  return (
    <div className="card rounded-2xl p-6 animate-fadeIn">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <FilmIcon className="w-6 h-6 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-200">Results</h2>
      </div>

      <div className="space-y-5">
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-xs font-medium text-gray-400 mb-2">Sequence ID</p>
          <p className="font-mono text-sm text-gray-300">{result.sequence_id}</p>
        </div>

        {result.video_ids && result.video_ids.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-gray-200 mb-3">Individual Shots</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {result.video_ids.map((videoId, index) => (
                <div key={index} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-sky-500 flex items-center justify-center text-white text-xs font-bold">
                      {index + 1}
                    </div>
                    <p className="font-semibold text-gray-300 text-sm">Shot {index + 1}</p>
                  </div>
                  <p className="text-xs text-gray-400 mb-3 font-mono break-all">
                    {videoId}
                  </p>
                  <a
                    href={getDownloadUrl(result.sequence_id!, index + 1)}
                    download
                    className="block w-full px-4 py-2.5 btn-primary rounded-xl text-center font-medium text-sm transition-all"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.video_ids && result.video_ids.length > 1 && (
          <div className="pt-5 border-t border-white/10">
            <h3 className="text-base font-semibold text-gray-200 mb-3">Complete Sequence</h3>
            <a
              href={getDownloadUrl(result.sequence_id!, 0)}
              download
              className="block px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-center font-semibold transition-all shadow-lg shadow-emerald-500/25"
            >
              Download Stitched Sequence
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
