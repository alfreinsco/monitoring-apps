import { Link } from '@inertiajs/react';
import { home } from '@/routes';
import { index as pengaturanIndex } from '@/routes/pengaturan';
import { index as riwayatIndex } from '@/routes/riwayat';
import { index as targetsIndex } from '@/routes/targets';

type PageKey = 'monitor' | 'targets' | 'riwayat' | 'pengaturan';

const menuItems = [
    { key: 'monitor', label: 'Monitor', href: home.url() },
    { key: 'targets', label: 'Domain & IP', href: targetsIndex.url() },
    { key: 'riwayat', label: 'Riwayat', href: riwayatIndex.url() },
    { key: 'pengaturan', label: 'Pengaturan', href: pengaturanIndex.url() },
] satisfies { key: PageKey; label: string; href: string }[];

export default function AppNavbar({ activePage }: { activePage: PageKey }) {
    return (
        <nav aria-label="Navigasi utama" className="border-t border-cyan-400/15">
            <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
                {menuItems.map((item) => {
                    const isActive = item.key === activePage;

                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${isActive ? 'bg-cyan-950/70 text-cyan-200' : 'text-slate-300 hover:bg-cyan-950/60 hover:text-cyan-200'}`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
