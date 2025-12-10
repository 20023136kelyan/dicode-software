import React from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface AvatarProps {
    src?: string | null;
    name?: string | null;
    email?: string | null;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Avatar({
    src,
    name,
    email,
    className,
    size = 'md'
}: AvatarProps) {
    // Get initials from name or email
    const getInitials = () => {
        if (name) {
            return name
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
        }
        if (email) {
            return email.substring(0, 2).toUpperCase();
        }
        return '?';
    };

    const sizeClasses = {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
        xl: 'h-24 w-24 text-3xl',
    };

    return (
        <div
            className={cn(
                'relative flex shrink-0 items-center justify-center rounded-full overflow-hidden',
                sizeClasses[size],
                !src && 'bg-gradient-to-br from-sky-400 to-violet-500 font-bold text-white shadow-sm',
                className
            )}
        >
            {src ? (
                <img
                    src={src}
                    alt={name || email || 'Avatar'}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                        // Fallback to initials if image fails to load
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.classList.add('bg-gradient-to-br', 'from-sky-400', 'to-violet-500', 'font-bold', 'text-white', 'shadow-sm');

                        // Create a text node for initials and append it
                        const textNode = document.createTextNode(getInitials());
                        e.currentTarget.parentElement?.appendChild(textNode);
                    }}
                />
            ) : (
                getInitials()
            )}
        </div>
    );
}
