import React from 'react';

interface Theme {
    name: string;
    type: 'user' | 'community';
    percentage?: number;
}

interface ThemeBubbleClusterProps {
    themes: Theme[];
}

const ThemeBubbleCluster: React.FC<ThemeBubbleClusterProps> = ({ themes }) => {
    // Separate user and community themes to layer them interestingly
    const userThemes = themes.filter(t => t.type === 'user');
    const communityThemes = themes.filter(t => t.type === 'community');

    return (
        <div className="relative h-[200px] w-full bg-gray-50 rounded-xl border border-gray-100 overflow-hidden flex items-center justify-center p-4">
            <div className="flex flex-wrap justify-center items-center gap-3 max-w-sm">

                {/* Render Community Themes first (background layer) */}
                {communityThemes.map((theme, idx) => (
                    <div
                        key={`comm-${idx}`}
                        className="bg-gray-400 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-sm opacity-80 transform scale-90"
                    >
                        {theme.name}
                    </div>
                ))}

                {/* Render User Themes (foreground layer, larger) */}
                {userThemes.map((theme, idx) => (
                    <div
                        key={`user-${idx}`}
                        className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-full shadow-md z-10 animate-pulse-slow border-2 border-white"
                    >
                        {theme.name} {theme.percentage ? `(${theme.percentage}%)` : ''}
                    </div>
                ))}

            </div>

            {/* Decorative background circles */}
            <div className="absolute top-[-20px] left-[-20px] w-24 h-24 bg-blue-100 rounded-full opacity-50 blur-xl"></div>
            <div className="absolute bottom-[-10px] right-[-10px] w-32 h-32 bg-gray-200 rounded-full opacity-50 blur-xl"></div>
        </div>
    );
};

export default ThemeBubbleCluster;
