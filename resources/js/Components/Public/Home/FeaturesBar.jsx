import React from "react";
import {
    IconSparkles,
    IconStar,
    IconTruckDelivery,
    IconHeadset,
} from "@tabler/icons-react";

export default function FeaturesBar() {
    const features = [
        {
            icon: IconSparkles,
            title: "Bahan Premium Pilihan",
            subtitle: "Material tekstil lembut & adem",
        },
        {
            icon: IconStar,
            title: "Standar Butik Jahitan",
            subtitle: "Presisi & detail berkualitas tinggi",
        },
        {
            icon: IconHeadset,
            title: "Layanan Admin Ramah",
            subtitle: "Konsultasi ukuran via WhatsApp",
        },
        {
            icon: IconTruckDelivery,
            title: "Pengiriman Cepat & Aman",
            subtitle: "Jangkauan seluruh Indonesia",
        },
    ];

    return (
        <div className="bg-white dark:bg-stone-950 text-karima-brand dark:text-stone-200 py-8 sm:py-10 border-t border-b border-karima-brand/10 dark:border-stone-800 relative z-10 w-full">
            <div className="container mx-auto max-w-7xl px-4 lg:px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 items-center">
                    {features.map((item, index) => {
                        const IconComponent = item.icon;
                        return (
                            <div
                                key={index}
                                className="flex flex-row items-center justify-start text-left gap-3.5 group"
                            >
                                <div className="text-karima-gold shrink-0 transition-transform duration-300 group-hover:scale-110">
                                    <IconComponent size={24} strokeWidth={1.5} />
                                </div>
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-semibold text-karima-brand dark:text-stone-100 leading-tight group-hover:text-karima-gold transition-colors truncate">
                                        {item.title}
                                    </span>
                                    <span className="text-[10px] sm:text-xxs text-karima-ink/50 dark:text-stone-400 font-serif leading-tight truncate">
                                        {item.subtitle}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

