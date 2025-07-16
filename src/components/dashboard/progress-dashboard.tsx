"use client";

import type { Account } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, UserPlus, UserCheck, UserX } from 'lucide-react';

interface ProgressDashboardProps {
  accounts: Account[];
  totalSignups: number;
}

export function ProgressDashboard({ accounts, totalSignups }: ProgressDashboardProps) {
  if (totalSignups === 0) return null;

  const attemptedCount = accounts.length;
  const createdCount = accounts.filter(a => a.status !== 'pending' && a.status !== 'failed').length;
  const verifiedCount = accounts.filter(a => a.status === 'verified').length;
  const failedCount = accounts.filter(a => a.status === 'failed').length;

  const totalProgress = totalSignups > 0 ? (attemptedCount / totalSignups) * 100 : 0;
  // We consider "created" as any step past generation, up to verified.
  const createdProgress = totalSignups > 0 ? (createdCount / totalSignups) * 100 : 0;
  // Verified progress is out of the accounts that were successfully created (not failed)
  const successfulCreations = attemptedCount - failedCount;
  const verifiedProgress = successfulCreations > 0 ? (verifiedCount / successfulCreations) * 100 : 0;

  const metrics = [
    { title: 'Overall Progress', count: attemptedCount, progress: totalProgress, Icon: Users, description: `${attemptedCount} of ${totalSignups} attempts started`},
    { title: 'Accounts Verified', count: verifiedCount, progress: verifiedProgress, Icon: UserCheck, description: `${verifiedCount} of ${successfulCreations} successful accounts verified`},
    { title: 'Failures', count: failedCount, progress: totalSignups > 0 ? (failedCount/totalSignups) * 100 : 0, Icon: UserX, description: `${failedCount} of ${totalSignups} attempts failed` }
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
            <Progress value={metric.progress} className={`mt-4 ${metric.title === 'Failures' ? '[&>div]:bg-destructive' : ''}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
