"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type DailyTask = {
  id: string;
  topic_id: string;
  topic_title: string;
  category: string;
  type: string;
  status: string;
  mastery: number;
  difficulty: number;
  plan_title?: string;
};

type Stats = {
  total: number;
  done: number;
  new_count: number;
  review_count: number;
};

export default function Dashboard() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [plansRes, tasksRes] = await Promise.all([
        fetch("/api/plans"),
        fetch("/api/daily-tasks"),
      ]);
      const plansData = await plansRes.json();
      const tasksData = await tasksRes.json();
      setPlans(plansData);
      setTasks(tasksData.tasks || []);
      setStats(tasksData.stats);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  const completionRate = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Today&apos;s learning tasks</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <div className="text-sm text-muted-foreground">Total Tasks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.new_count || 0}</div>
            <div className="text-sm text-muted-foreground">New Topics</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.review_count || 0}</div>
            <div className="text-sm text-muted-foreground">Reviews</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{completionRate}%</div>
            <div className="text-sm text-muted-foreground">Completed</div>
            <Progress value={completionRate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* No plans yet */}
      {plans.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">No study plans yet. Create one to get started.</p>
            <Link href="/plan">
              <Button>Create Study Plan</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Today's tasks */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      task.status === "done" ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  />
                  <div>
                    <div className="font-medium">{task.topic_title}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.category} {task.plan_title && `· ${task.plan_title}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={task.type === "new" ? "default" : "secondary"}>
                    {task.type === "new" ? "New" : "Review"}
                  </Badge>
                  {task.status === "done" ? (
                    <Badge variant="outline" className="text-green-500">Done</Badge>
                  ) : (
                    <Link href={`/study/${task.topic_id}`}>
                      <Button size="sm">Study</Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active plans */}
      {plans.filter((p) => p.status === "active").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plans
              .filter((p) => p.status === "active")
              .map((plan) => (
                <Link
                  key={plan.id}
                  href={`/plan/${plan.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  {plan.title}
                </Link>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
