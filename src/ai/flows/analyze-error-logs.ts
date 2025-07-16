
// This file is machine-generated - edit at your own risk!

'use server';

/**
 * @fileOverview Analyzes error logs related to account creation and suggests potential fixes.
 *
 * - analyzeErrorLogs - A function that handles the error log analysis process.
 * - AnalyzeErrorLogsInput - The input type for the analyzeErrorLogs function.
 * - AnalyzeErrorLogsOutput - The return type for the analyzeErrorLogs function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeErrorLogsInputSchema = z.object({
  errorLogs: z
    .string()
    .describe('The full error logs related to an account creation failure, including any stack traces.'),
});
export type AnalyzeErrorLogsInput = z.infer<typeof AnalyzeErrorLogsInputSchema>;

const AnalyzeErrorLogsOutputSchema = z.object({
  analysis: z.string().describe('A step-by-step analysis of what went wrong based on the error logs. Be concise and clear.'),
  suggestedFixes: z.string().describe('Actionable, specific suggestions for how to fix the underlying problem. This could involve code changes or configuration adjustments.'),
});
export type AnalyzeErrorLogsOutput = z.infer<typeof AnalyzeErrorLogsOutputSchema>;

export async function analyzeErrorLogs(input: AnalyzeErrorLogsInput): Promise<AnalyzeErrorLogsOutput> {
  return analyzeErrorLogsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeErrorLogsPrompt',
  input: {schema: AnalyzeErrorLogsInputSchema},
  output: {schema: AnalyzeErrorLogsOutputSchema},
  prompt: `You are an expert software troubleshooter specializing in Python FastAPI backends, aiohttp, and Supabase authentication.

You will analyze the provided error logs from a user's application and provide a clear, concise analysis and suggested fixes. Assume the user is a developer who needs to understand the root cause.

Error Logs:
{{{errorLogs}}}`,
});

const analyzeErrorLogsFlow = ai.defineFlow(
  {
    name: 'analyzeErrorLogsFlow',
    inputSchema: AnalyzeErrorLogsInputSchema,
    outputSchema: AnalyzeErrorLogsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
