import type { ReactNode } from 'react';

interface AppBrandProps {
    subtitle: string;
    status?: ReactNode;
    className?: string;
}

export default function AppBrand({ subtitle, status, className = '' }: AppBrandProps) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className="cyber-glow-cyan flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/60 bg-cyan-500/20 text-cyan-300" aria-hidden="true">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                </svg>
            </div>
            <div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">Monitoring Domain &amp; IP</h1>
                    {status}
                </div>
                <p className="text-xs text-slate-300">{subtitle}</p>
            </div>
        </div>
    );
}
