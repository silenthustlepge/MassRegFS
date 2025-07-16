"use client";

import type { Account } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle2, XCircle, LogIn, Wrench, FileText } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import * as React from 'react';

interface AccountListProps {
  accounts: Account[];
  onTroubleshoot: (errorLog: string) => void;
}

export function AccountList({ accounts, onTroubleshoot }: AccountListProps) {
  const [selectedAccount, setSelectedAccount] = React.useState<Account | null>(null);

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10">
            <FileText className="h-12 w-12 mb-4" />
            <p>No accounts to display.</p>
            <p className="text-sm">Start a new process to see accounts here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: Account['status']) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-accent text-accent-foreground hover:bg-accent/80"><CheckCircle2 className="mr-1 h-3 w-3" />Verified</Badge>;
      case 'created':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Created</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Account List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.id}</TableCell>
                    <TableCell>{account.username}</TableCell>
                    <TableCell>{getStatusBadge(account.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {account.status === 'failed' && account.errorLog && (
                        <Button variant="outline" size="sm" onClick={() => onTroubleshoot(account.errorLog!)}>
                          <Wrench className="mr-2 h-4 w-4" />
                          Analyze Error
                        </Button>
                      )}
                      {(account.status === 'created' || account.status === 'verified') && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedAccount(account)}>
                          <LogIn className="mr-2 h-4 w-4" />
                          Login Info
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={!!selectedAccount} onOpenChange={(open) => !open && setSelectedAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline">Login Information</AlertDialogTitle>
            <AlertDialogDescription>
              Use these credentials to log in. This information is for demonstration purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm space-y-2 font-mono">
            <div><strong>Username:</strong> {selectedAccount?.username}</div>
            <div><strong>Password:</strong> {selectedAccount?.password || 'N/A'}</div>
            <div><strong>Token:</strong> <span className="bg-muted px-1 py-0.5 rounded">{selectedAccount?.token || 'N/A'}</span></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSelectedAccount(null)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
