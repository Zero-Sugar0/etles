import { tool, generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";

export const analyzeContract = ({ userId }: { userId: string }) =>
  tool({
    description: "Analyze a contract to extract key terms, obligations, and risks.",
    inputSchema: z.object({
      contractText: z.string().describe("The full text of the contract to analyze"),
    }),
    execute: async ({ contractText }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const { object } = await generateObject({
          model,
          schema: z.object({
            parties: z.array(z.object({
              name: z.string(),
              role: z.string(),
            })),
            effectiveDate: z.string().optional(),
            terminationDate: z.string().optional(),
            autoRenewal: z.boolean(),
            noticePeriod: z.string().optional(),
            keyObligations: z.array(z.string()),
            riskClauses: z.array(z.object({
              clause: z.string(),
              riskLevel: z.enum(["low", "medium", "high"]),
              explanation: z.string(),
            })),
            summary: z.string(),
          }),
          prompt: `Analyze the following contract and extract key information.
          Be precise and thorough. If a field is not found, leave it empty or false.

          Contract Text:
          ${contractText}`,
        });

        return { success: true, analysis: object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

export const compareContracts = ({ userId }: { userId: string }) =>
  tool({
    description: "Compare two contracts or two versions of the same contract.",
    inputSchema: z.object({
      originalText: z.string().describe("The original contract text"),
      newText: z.string().describe("The new or revised contract text"),
    }),
    execute: async ({ originalText, newText }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const { object } = await generateObject({
          model,
          schema: z.object({
            changes: z.array(z.object({
              type: z.enum(["addition", "deletion", "modification"]),
              section: z.string(),
              description: z.string(),
              impact: z.enum(["positive", "neutral", "negative"]),
            })),
            overallImpact: z.string(),
            recommendation: z.string(),
          }),
          prompt: `Compare the following two versions of a contract.
          Identify key differences and assess their impact on the user.

          Original Text:
          ${originalText}

          New Text:
          ${newText}`,
        });

        return { success: true, comparison: object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });
