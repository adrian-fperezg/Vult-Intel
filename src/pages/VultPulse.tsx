import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useUserMetrics } from '@/hooks/useUserMetrics';
import { Navigate } from 'react-router-dom';

export default function VultPulse() {
    const { t } = useTranslation();
    const { activeAddons } = useUserMetrics();
    const hasVultPulse = activeAddons.includes('vult_pulse');

    if (!hasVultPulse) {
        return <Navigate to="/settings" replace />;
    }

    return (
        <div className="p-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-violet-500/20 text-violet-400 rounded-xl">
                    <MessageCircle className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white">Vult Pulse</h1>
                    <p className="text-slate-400 mt-1">AI-powered DM automation for Instagram, Facebook & WhatsApp.</p>
                </div>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
                <MessageCircle className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
                <h2 className="text-2xl font-bold text-white mb-2">Vult Pulse is active</h2>
                <p className="text-slate-400 max-w-lg mx-auto">
                    Your Vult Pulse module is unlocked. The canvas and workflow builder for chat automation will be available here soon.
                </p>
            </div>
        </div>
    );
}
