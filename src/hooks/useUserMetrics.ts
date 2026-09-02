import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
    calculateTotalLimits,
    UserSubscriptionProfile,
    SubscriptionLimits,
    PlanId,
    AddonId,
    BASE_PLAN_LIMITS,
    UNLIMITED_LIMITS
} from '@/utils/subscriptionManager';

export interface UserMetrics {
    tokensUsed: number;
    deepScansGenerated: number;
    imagesGenerated: number;
    videosGenerated: number;
}

export interface UseUserMetricsReturn {
    // Limits
    totalLimits: SubscriptionLimits;
    // Current usage
    metrics: UserMetrics;
    // Profile info
    currentPlanId: PlanId;
    activeAddons: AddonId[];
    // Status
    loading: boolean;
    error: Error | null;
}

export function useUserMetrics(): UseUserMetricsReturn {
    const { currentUser, isFounder } = useAuth();

    const [currentPlanId, setCurrentPlanId] = useState<PlanId>('solo');
    const [activeAddons, setActiveAddons] = useState<AddonId[]>([]);
    const [metrics, setMetrics] = useState<UserMetrics>({
        tokensUsed: 0,
        deepScansGenerated: 0,
        imagesGenerated: 0,
        videosGenerated: 0,
    });

    // Default to 'solo' limits as a safe fallback
    const [totalLimits, setTotalLimits] = useState<SubscriptionLimits>(BASE_PLAN_LIMITS['solo']);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (isFounder) {
            setTotalLimits(UNLIMITED_LIMITS);
            setActiveAddons(['veo_studio_pack', 'outreach', 'vult_pulse']);
            setLoading(false);
            return;
        }

        if (!currentUser) {
            setLoading(false);
            return;
        }

        let isMounted = true;
        const userRef = doc(db, 'customers', currentUser.uid);

        const unsubscribe = onSnapshot(
            userRef,
            (docSnap) => {
                if (!isMounted) return;

                if (docSnap.exists()) {
                    const data = docSnap.data();

                    // Parse profile data with fallbacks
                    const planId: PlanId = data.planId || 'solo';
                    const addons: AddonId[] = data.activeAddons || [];

                    setCurrentPlanId(planId);
                    setActiveAddons(addons);

                    // Parse metrics with fallbacks
                    setMetrics({
                        tokensUsed: data.totalTokensUsed || 0,
                        deepScansGenerated: data.deepScansGenerated || 0,
                        imagesGenerated: data.imagesGenerated || 0,
                        videosGenerated: data.videosGenerated || 0,
                    });

                    try {
                        const profile: UserSubscriptionProfile = {
                            currentPlanId: planId,
                            activeAddons: addons,
                        };
                        const calculatedLimits = calculateTotalLimits(profile);
                        setTotalLimits(calculatedLimits);
                        setError(null);
                    } catch (err) {
                        console.error('Error calculating limits:', err);
                        // Fallback to strict zero limits if calculation fails
                        setTotalLimits({
                            tokens: 0,
                            projects: 0,
                            personas: 0,
                            pillars: 0,
                            deepScans: 0,
                            images: 0,
                            videos: 0,
                        });
                    }
                } else {
                    // Reset if doc doesn't exist
                    setCurrentPlanId('solo');
                    setActiveAddons([]);
                    setTotalLimits({
                        tokens: 0,
                        projects: 0,
                        personas: 0,
                        pillars: 0,
                        deepScans: 0,
                        images: 0,
                        videos: 0,
                    });
                }
                setLoading(false);
            },
            (err) => {
                if (err.name === 'AbortError' || err.code === 'cancelled') {
                    console.log('[useUserMetrics] AbortError ignored');
                    return;
                }
                console.error('Error listening to user metrics:', err);
                if (isMounted) {
                    setError(err as Error);
                    setLoading(false);
                }
            }
        );

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [currentUser, isFounder]);

    return {
        totalLimits,
        metrics,
        currentPlanId,
        activeAddons,
        loading,
        error,
    };
}
