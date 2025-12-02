import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface RadarOverviewProps {
    data: {
        subject: string;
        A: number; // User
        B: number; // Community
        fullMark: number;
    }[];
}

const RadarOverview: React.FC<RadarOverviewProps> = ({ data }) => {
    // Ensure we have at least 3 points for a valid polygon, otherwise Recharts might behave oddly
    if (!data || data.length < 3) return null;

    return (
        <div className="w-full h-[300px] flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />

                    {/* Series 1: Community (Gray Fill, No Stroke) */}
                    <Radar
                        name="Community"
                        dataKey="B"
                        stroke="none"
                        fill="#9CA3AF"
                        fillOpacity={0.2}
                    />

                    {/* Series 2: User (Blue Stroke, Transparent Fill) */}
                    <Radar
                        name="You"
                        dataKey="A"
                        stroke="#2563EB"
                        strokeWidth={3}
                        fill="transparent"
                        fillOpacity={0}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default RadarOverview;
