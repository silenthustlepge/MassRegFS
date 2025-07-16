
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This configures the Genkit AI instance.
// It uses the Google AI plugin and specifies a default model.
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-pro',
});
