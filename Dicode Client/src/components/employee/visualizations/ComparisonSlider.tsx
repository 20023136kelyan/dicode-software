import React, { useEffect, useState } from 'react';

interface ComparisonSliderProps {
    userValue: number; // 1-5
    avgValue: number; // 1-5
    minLabel?: string;
    maxLabel?: string;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
    userValue,
    avgValue,
    minLabel = 'Low',
    maxLabel = 'High'
}) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Trigger animation after mount
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Calculate percentages (1-5 scale)
    // 1 = 0%, 5 = 100% -> (val - 1) / 4 * 100
    const getPercent = (val: number) => Math.max(0, Math.min(100, ((val - 1) / 4) * 100));

    const userPercent = getPercent(userValue);
    const avgPercent = getPercent(avgValue);

    return (
        <div className="mt-8 mb-10 relative px-4">
            {/* Track */}
            <div className="h-3 w-full rounded-full bg-gradient-to-r from-red-100 via-orange-100 to-blue-100 relative shadow-inner">

                {/* AVG Marker (Bottom) */}
                <div
                    className="absolute top-full mt-2 transform -translate-x-1/2 flex flex-col items-center transition-all duration-1000 ease-out z-10"
                    style={{ left: mounted ? `${avgPercent}%` : '0%' }}
                >
                    {/* Triangle pointing UP */}
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-gray-400 mb-[-1px]"></div>
                    {/* Bubble */}
                    <div className="bg-gray-400 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">
                        AVG
                    </div>
                </div>

                {/* YOU Marker (Top) */}
                <div
                    className="absolute bottom-full mb-2 transform -translate-x-1/2 flex flex-col items-center transition-all duration-1000 ease-out z-20"
                    style={{ left: mounted ? `${userPercent}%` : '0%' }}
                >
                    {/* Bubble */}
                    <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm mb-[-1px] whitespace-nowrap">
                        YOU
                    </div>
                    {/* Triangle pointing DOWN */}
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-600"></div>
                </div>

            </div>

            {/* Scale Labels */}
            <div className="flex justify-between text-xs text-gray-400 mt-10 font-medium uppercase tracking-wide">
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
            </div>
        </div>
    );
};

export default ComparisonSlider;
