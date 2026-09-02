import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Activity,
  Lock,
  RefreshCcw,
  Database,
  Server,
  Zap,
  Mail,
  Flame
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface SystemHealth {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  dependencies: {
    postgres?: string;
    redis?: string;
    ai_gemini?: string;
    ai_veo?: string;
    firebase?: string;
    gmail_api?: { status: string; connected: number; rateLimited: number };
    email_imap?: { status: string; error?: string };
    [key: string]: any;
  };
}

const API_BASE = import.meta.env.VITE_OUTREACH_API_URL || import.meta.env.VITE_API_URL || 'https://vult-intel-backend-production.up.railway.app';

export default function AdminDashboard() {
  const { isFounder, currentUser } = useAuth();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      
      if (!response.ok && response.status !== 503) {
        throw new Error('Failed to fetch health data');
      }
      
      const json = await response.json();
      setHealth(json);
    } catch (error) {
      console.error('[ADMIN_HEALTH_FETCH]', error);
      toast.error('Failed to load system diagnostics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFounder) {
      fetchHealth();
      // Poll every 30 seconds
      const interval = setInterval(fetchHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [isFounder]);

  if (!isFounder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="size-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <Lock className="size-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
        <p className="text-slate-400 max-w-md">
          This portal is reserved for platform administrators only. If you believe this is an error, please contact support.
        </p>
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600*24));
    const hours = Math.floor(seconds % (3600*24) / 3600);
    const mins = Math.floor(seconds % 3600 / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const isDegraded = health?.status !== 'ok';
  
  // Count how many dependencies are in an error state
  const criticalCount = health ? Object.entries(health.dependencies).filter(([k, v]) => {
    if (typeof v === 'string') return v.includes('disconnected') || v.includes('missing') || v.includes('uninitialized') || v.includes('unhealthy');
    if (typeof v === 'object' && v !== null && v.status) return v.status !== 'ok' && v.status !== 'connected';
    return false;
  }).length : 0;

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 lg:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Shield className="size-6 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Platform Diagnostics</h1>
          </div>
          <p className="text-slate-400 font-medium">Real-time System Health & Monitoring</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {health?.timestamp && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Activity className="size-3.5 text-slate-500" />
              <span className="text-xs text-slate-500 font-medium tabular-nums">
                Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
          <button 
            onClick={fetchHealth}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all group"
          >
            <RefreshCcw className={cn("size-4 text-slate-400 group-hover:text-white transition-all", isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("p-6 rounded-2xl border backdrop-blur-xl relative overflow-hidden group",
            isDegraded ? "bg-orange-500/5 border-orange-500/20" : "bg-emerald-500/5 border-emerald-500/20"
          )}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
            <Activity className={cn("size-24", isDegraded ? "text-orange-500" : "text-emerald-500")} />
          </div>
          <div className="space-y-4">
            <p className={cn("text-sm font-bold uppercase tracking-wider", isDegraded ? "text-orange-400" : "text-emerald-400")}>
              System Status
            </p>
            <div className="flex items-baseline gap-3">
              <span className={cn("text-4xl font-bold", isDegraded ? "text-orange-500" : "text-emerald-500")}>
                {isDegraded ? 'Degraded' : 'Operational'}
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn("p-6 rounded-2xl border backdrop-blur-xl relative overflow-hidden group",
            criticalCount > 0 ? "bg-red-500/5 border-red-500/20" : "bg-surface-dark/50 border-surface-border"
          )}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
            <AlertTriangle className={cn("size-24", criticalCount > 0 ? "text-red-500" : "text-white")} />
          </div>
          <div className="space-y-4">
            <p className={cn("text-sm font-bold uppercase tracking-wider", criticalCount > 0 ? "text-red-400" : "text-slate-400")}>
              Critical Alerts
            </p>
            <div className="flex items-baseline gap-3">
              <span className={cn("text-4xl font-bold", criticalCount > 0 ? "text-red-500" : "text-white")}>
                {criticalCount}
              </span>
              <span className={cn("text-sm font-semibold", criticalCount > 0 ? "text-red-400/60" : "text-slate-500")}>
                {criticalCount > 0 ? 'Immediate Action Required' : 'All systems go'}
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20 backdrop-blur-xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
            <Activity className="size-24 text-blue-500" />
          </div>
          <div className="space-y-4">
            <p className="text-sm font-bold text-blue-400/70 uppercase tracking-wider">Backend Uptime</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-blue-500">
                {health ? formatUptime(health.uptime) : '--'}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {isLoading && !health ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[120px] rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            ))
          ) : health ? (
            <>
              {/* PostgreSQL */}
              <DiagnosticCard 
                title="PostgreSQL Database" 
                icon={<Database className="size-5" />} 
                value={health.dependencies.postgres || 'Unknown'} 
                isHealthy={health.dependencies.postgres?.includes('connected')}
                details={health.dependencies.postgres}
              />
              {/* Firebase */}
              <DiagnosticCard 
                title="Firebase Admin SDK" 
                icon={<Flame className="size-5" />} 
                value={health.dependencies.firebase === 'initialized' ? 'Initialized' : 'Error'} 
                isHealthy={health.dependencies.firebase === 'initialized'}
                details="Authentication & Firestore connection"
              />
              {/* Redis */}
              <DiagnosticCard 
                title="Redis Cache / Queue" 
                icon={<Server className="size-5" />} 
                value={health.dependencies.redis || 'Unknown'} 
                isHealthy={health.dependencies.redis?.includes('connected')}
                details="BullMQ and Caching infrastructure"
              />
              {/* AI Gemini */}
              <DiagnosticCard 
                title="Google Gemini AI" 
                icon={<Zap className="size-5" />} 
                value={health.dependencies.ai_gemini === 'configured' ? 'Configured' : 'Missing API Key'} 
                isHealthy={health.dependencies.ai_gemini === 'configured'}
                details="Main AI provider for generation"
              />
              {/* Gmail API */}
              <DiagnosticCard 
                title="Gmail API Infrastructure" 
                icon={<Mail className="size-5" />} 
                value={health.dependencies.gmail_api?.status === 'ok' ? 'Operational' : 'Degraded'} 
                isHealthy={health.dependencies.gmail_api?.status === 'ok'}
                details={health.dependencies.gmail_api 
                  ? `Connected Mailboxes: ${health.dependencies.gmail_api.connected} | Rate Limited: ${health.dependencies.gmail_api.rateLimited}` 
                  : 'N/A'}
              />
              {/* IMAP */}
              <DiagnosticCard 
                title="IMAP Reply Tracking" 
                icon={<Mail className="size-5" />} 
                value={health.dependencies.email_imap?.status === 'connected' ? 'Healthy' : 'Unhealthy'} 
                isHealthy={health.dependencies.email_imap?.status === 'connected'}
                details={health.dependencies.email_imap?.error || health.dependencies.email_imap?.status}
              />
            </>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="pt-8 border-t border-surface-border flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
          <Shield className="size-3" /> 
          Vult Intel Administrator Control Panel — Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}

function DiagnosticCard({ title, icon, value, isHealthy, details }: { title: string, icon: React.ReactNode, value: string, isHealthy: boolean | undefined, details?: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "p-6 rounded-2xl border backdrop-blur-md flex flex-col gap-4 group transition-all duration-300",
        isHealthy 
          ? "bg-emerald-500/[0.03] border-emerald-500/20" 
          : "bg-red-500/[0.03] border-red-500/20"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isHealthy ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
          )}>
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">{title}</h3>
            {details && <p className="text-xs text-slate-500 font-medium mt-1">{details}</p>}
          </div>
        </div>
        <span className={cn(
          "px-2.5 py-1 rounded-md text-xs font-bold tracking-wider flex items-center gap-1.5",
          isHealthy 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
            : "bg-red-500/10 text-red-400 border border-red-500/20"
        )}>
          {isHealthy ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
          {value}
        </span>
      </div>
    </motion.div>
  );
}
