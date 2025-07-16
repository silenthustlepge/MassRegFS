
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
import { Clock, CheckCircle2, XCircle, LogIn, Wrench, FileText, Mail, Send, Check, Copy, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface AccountListProps {
  accounts: Account[];
  onTroubleshoot: (errorLog: string) => void;
}

const API_BASE_URL = 'https://e2201c8c-46f3-41c2-a0f6-d470b3e0403c.preview.emergentagent.com';

export function AccountList({ accounts, onTroubleshoot }: AccountListProps) {
  const { toast } = useToast();
  const [copyingLinks, setCopyingLinks] = useState<Set<number>>(new Set());

  const handleCopyVerificationLink = async (account: Account) => {
    if (copyingLinks.has(account.id)) return;

    setCopyingLinks(prev => new Set(prev).add(account.id));
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/account/${account.id}/verification-link`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.detail || "Failed to fetch verification link");
      }
      
      if (result.verification_link) {
        await navigator.clipboard.writeText(result.verification_link);
        toast({
          title: "Success",
          description: "Verification link copied to clipboard!",
        });
      } else {
        toast({
          variant: "destructive",
          title: "No Link Available",
          description: result.message || "No verification link available for this account",
        });
      }
    } catch (error: any) {
      console.error("Failed to copy verification link:", error);
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: error.message || "Failed to copy verification link",
      });
    } finally {
      setCopyingLinks(prev => {
        const newSet = new Set(prev);
        newSet.delete(account.id);
        return newSet;
      });
    }
  };

  const handleLoginClick = async (account: Account) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/account/${account.id}/login-details`);
      const resJson = await response.json();
      
      if (!response.ok) {
        throw new Error(resJson.detail || "Could not fetch login details. The account might not be fully verified yet.");
      }
      
      const loginDetails = resJson;

      if (!loginDetails.access_token || !loginDetails.refresh_token) {
        throw new Error("Login details are incomplete. Please try again later.");
      }

      // This uses a relative path to a static file in the public folder.
      const loginLoaderUrl = `/login-loader.html?access_token=${encodeURIComponent(loginDetails.access_token)}&refresh_token=${encodeURIComponent(loginDetails.refresh_token)}`;
      window.open(loginLoaderUrl, '_blank');

    } catch (error: any) {
      console.error("Login failed for account", account, error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "An unexpected error occurred.",
      });
    }
  };

  const getStatusBadge = (status: Account['status']) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500 text-white hover:bg-green-500/80"><CheckCircle2 className="mr-1 h-3 w-3" />Verified</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case 'credentials_generated':
        return <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Generated</Badge>;
      case 'verification_link_sent':
        return <Badge variant="secondary"><Send className="mr-1 h-3 w-3" />Link Sent</Badge>;
      case 'email_received':
        return <Badge variant="secondary"><Mail className="mr-1 h-3 w-3" />Email Received</Badge>;
      default:
        // A fallback for any unexpected status
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />{status}</Badge>;
    }
  };

  // The parent component now handles sorting, but we can ensure it here too.
  const sortedAccounts = [...accounts].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Account List</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedAccounts.length === 0 ? (
           <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10">
              <FileText className="h-12 w-12 mb-4" />
              <p className="font-semibold">No accounts to display.</p>
              <p className="text-sm">Use the control panel above to start generating accounts.</p>
            </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAccounts.map((account) => {
                  if (!account.id) return null; // Prevent rendering if account ID is missing
                  const isLoginReady = account.status === 'verified';
                  const isFailed = account.status === 'failed';
                  
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.id}</TableCell>
                      <TableCell>{account.email}</TableCell>
                      <TableCell>{account.full_name}</TableCell>
                      <TableCell>{getStatusBadge(account.status)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {isFailed && account.errorLog && (
                          <Button variant="outline" size="sm" onClick={() => onTroubleshoot(account.errorLog as string)}>
                            <Wrench className="mr-2 h-4 w-4" />
                            Analyze Error
                          </Button>
                        )}
                        
                        {/* Copy Verification Link Button - Available for accounts that have received verification links */}
                        {(account.status === 'verification_link_sent' || account.status === 'email_received' || account.status === 'failed') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleCopyVerificationLink(account)}
                            disabled={copyingLinks.has(account.id)}
                          >
                            {copyingLinks.has(account.id) ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Copy className="mr-2 h-4 w-4" />
                            )}
                            Copy Link
                          </Button>
                        )}
                        
                        <Button variant="ghost" size="sm" onClick={() => handleLoginClick(account)} disabled={!isLoginReady}>
                          <LogIn className="mr-2 h-4 w-4" />
                          Login
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
