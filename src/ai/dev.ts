
import { config } from 'dotenv';
config();

// This file is the entrypoint for Genkit's dev server.
// It imports the flows so they are registered with Genkit.
import './flows/analyze-error-logs.ts';
