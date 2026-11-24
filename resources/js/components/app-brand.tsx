import type { ReactNode } from 'react';

interface AppBrandProps {
    subtitle: string;
    status?: ReactNode;
    className?: string;
}

export default function AppBrand({ subtitle, status, className = '' }: AppBrandProps) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className="cyber-glow-cyan flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-300/60 bg-[#07111f]" aria-hidden="true">
                <img src="/favicon.png" alt="" className="h-full w-full object-cover" />
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
