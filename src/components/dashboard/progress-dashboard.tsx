
"use client";

import type { Account } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, UserCheck, UserX } from 'lucide-react';
import { useMemo } from 'react';

interface ProgressDashboardProps {
  accounts: Account[];
  totalSignups: number;
}

export function ProgressDashboard({ accounts, totalSignups }: ProgressDashboardProps) {
  const { attemptedCount, verifiedCount, failedCount } = useMemo(() => {
    let attempted = 0;
    let verified = 0;
    let failed = 0;
    
    // Use a Set to count unique account IDs attempted.
    const attemptedIds = new Set<number>();
    accounts.forEach(a => {
      attemptedIds.add(a.id);
      if (a.status === 'verified') verified++;
      if (a.status === 'failed') failed++;
    });

    attempted = attemptedIds.size;

    return { attemptedCount: attempted, verifiedCount: verified, failedCount: failed };
  }, [accounts]);

  const completedCount = verifiedCount + failedCount;
  
  const overallProgress = totalSignups > 0 ? (completedCount / totalSignups) * 100 : 0;
  const successRate = attemptedCount > 0 ? (verifiedCount / attemptedCount) * 100 : 0;
  const failureRate = attemptedCount > 0 ? (failedCount / attemptedCount) * 100 : 0;

  const metrics = [
    { title: 'Overall Progress', count: completedCount, total: totalSignups, progress: overallProgress, Icon: Users, description: `${completedCount} of ${totalSignups} signups complete`},
    { title: 'Accounts Verified', count: verifiedCount, total: attemptedCount, progress: successRate, Icon: UserCheck, description: `${verifiedCount} of ${attemptedCount} attempts successful` },
    { title: 'Failures', count: failedCount, total: attemptedCount, progress: failureRate, Icon: UserX, description: `${failedCount} of ${attemptedCount} attempts failed` }
  ];
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <metric.Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.count}</div>
            <p className="text-xs text-muted-foreground">
              {metric.description}
            </p>
            <Progress value={metric.progress} className={`mt-4 ${metric.title === 'Failures' && metric.count > 0 ? '[&>div]:bg-destructive' : ''}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
