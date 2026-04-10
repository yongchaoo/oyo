"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type PlanWithStats = {
  id: string;
  title: string;
  status: string;
  topics: Array<{
    id: string;
    title: string;
    category: string | null;
    mastery: number;
    status: string;
  }>;
  stats: {
    total: number;
    mastered: number;
    reviewing: number;
    learning: number;
    new_count: number;
    avg_mastery: number;
  };
};

export default function ProgressPage() {
  const [plans, setPlans] = useState<PlanWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/plans");
      const planList = await res.json();

      const detailed = await Promise.all(
        planList.map(async (p: { id: string }) => {
          const r = await fetch(`/api/plans/${p.id}`);
          return r.json();
        })
      );
      setPlans(detailed);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Progress Overview</h1>
        <p className="text-muted-foreground">Your knowledge mastery across all plans</p>
      </div>

      {plans.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No plans yet.</p>
      )}

      {plans.map((plan) => {
        const categories = plan.topics.reduce<Record<string, typeof plan.topics>>((acc, t) => {
          const cat = t.category || "Other";
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(t);
          return acc;
        }, {});

        const avgMastery = Math.round(plan.stats?.avg_mastery || 0);

        return (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.title}</CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{avgMastery}% mastery</span>
                  <Progress value={avgMastery} className="w-32 h-2" />
                </div>
              </div>
              {/* Legend */}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Mastered ({plan.stats?.mastered || 0})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Reviewing ({plan.stats?.reviewing || 0})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Learning ({plan.stats?.learning || 0})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> New ({plan.stats?.new_count || 0})
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {Object.entries(categories).map(([category, topics]) => {
                const catMastery = Math.round(
                  topics.reduce((sum, t) => sum + t.mastery, 0) / topics.length
                );
                return (
                  <div key={category} className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{category}</span>
                      <span className="text-xs text-muted-foreground">{catMastery}%</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {topics.map((topic) => (
                        <div
                          key={topic.id}
                          title={`${topic.title}: ${topic.mastery}%`}
                          className={`w-6 h-6 rounded text-[8px] flex items-center justify-center font-bold cursor-default ${
                            topic.mastery >= 90
                              ? "bg-green-500/80 text-white"
                              : topic.mastery >= 60
                              ? "bg-blue-500/80 text-white"
                              : topic.mastery >= 30
                              ? "bg-yellow-500/80 text-black"
                              : topic.mastery > 0
                              ? "bg-orange-500/80 text-white"
                              : "bg-gray-300 text-gray-600"
                          }`}
                        >
                          {topic.mastery}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
