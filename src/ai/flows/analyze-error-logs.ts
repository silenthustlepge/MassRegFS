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
    .describe('The error logs related to account creation.'),
});
export type AnalyzeErrorLogsInput = z.infer<typeof AnalyzeErrorLogsInputSchema>;

const AnalyzeErrorLogsOutputSchema = z.object({
  analysis: z.string().describe('The analysis of the error logs.'),
  suggestedFixes: z.string().describe('Suggested fixes for the errors.'),
});
export type AnalyzeErrorLogsOutput = z.infer<typeof AnalyzeErrorLogsOutputSchema>;

export async function analyzeErrorLogs(input: AnalyzeErrorLogsInput): Promise<AnalyzeErrorLogsOutput> {
  return analyzeErrorLogsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeErrorLogsPrompt',
  input: {schema: AnalyzeErrorLogsInputSchema},
  output: {schema: AnalyzeErrorLogsOutputSchema},
  prompt: `You are an expert troubleshooter specializing in account creation errors.

You will analyze the provided error logs and suggest potential fixes.

Error Logs:
{{errorLogs}}`,
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
