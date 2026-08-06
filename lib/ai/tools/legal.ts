import { generateObject, tool } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";

// =============================================================================
// SECTION 1 — Analyze Contract
// =============================================================================

export const analyzeContract = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Analyze a contract to extract all key terms, parties, obligations, risks, " +
      "and actionable insights. Returns structured data including governing law, " +
      "jurisdiction, dispute resolution, confidentiality, indemnification, liability caps, " +
      "termination conditions, automatic renewal clauses, and a comprehensive risk assessment.",
    inputSchema: z.object({
      contractText: z
        .string()
        .describe("The full text of the contract to analyze"),
      context: z
        .string()
        .optional()
        .describe(
          "Optional context about the user's role (e.g. 'I am the licensor', 'I am the employee')"
        ),
    }),
    execute: async ({ contractText, context }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const { object } = await generateObject({
          model,
          schema: z.object({
            metadata: z.object({
              documentType: z
                .string()
                .describe("Type of legal document detected"),
              language: z.string().optional(),
              pageCount: z.number().optional(),
              hasSignatures: z.boolean(),
              executionDate: z.string().optional(),
            }),
            parties: z.array(
              z.object({
                name: z.string(),
                role: z.string(),
                address: z.string().optional(),
                representedBy: z.string().optional(),
              })
            ),
            effectiveDate: z.string().optional(),
            term: z.object({
              initialTerm: z.string().optional(),
              renewalTerms: z.string().optional(),
              autoRenewal: z.boolean(),
              noticePeriodForNonRenewal: z.string().optional(),
              terminationForConvenience: z.string().optional(),
              terminationForCause: z.string().optional(),
              terminationForInsolvency: z.boolean().optional(),
            }),
            financialTerms: z.object({
              paymentAmount: z.string().optional(),
              paymentFrequency: z.string().optional(),
              paymentMethod: z.string().optional(),
              latePaymentPenalties: z.string().optional(),
              currency: z.string().optional(),
              taxesAndWithholding: z.string().optional(),
              mostFavoredNation: z.boolean().optional(),
              priceAdjustmentMechanism: z.string().optional(),
            }),
            keyObligations: z.array(
              z.object({
                party: z.string(),
                obligation: z.string(),
                deadline: z.string().optional(),
                conditional: z.string().optional(),
              })
            ),
            intellectualProperty: z.object({
              ipOwnership: z.string().optional(),
              licenseGrants: z.array(z.string()).optional(),
              restrictions: z.array(z.string()).optional(),
              feedbackRights: z.string().optional(),
            }),
            confidentiality: z.object({
              duration: z.string().optional(),
              exceptions: z.array(z.string()).optional(),
              permittedDisclosures: z.array(z.string()).optional(),
              returnOfConfidentialInformation: z.string().optional(),
            }),
            indemnification: z.object({
              indemnifyingParty: z.string().optional(),
              scope: z.string().optional(),
              caps: z.string().optional(),
              survival: z.string().optional(),
              mutual: z.boolean().optional(),
            }),
            limitationOfLiability: z.object({
              liabilityCap: z.string().optional(),
              exclusions: z.array(z.string()).optional(),
              consequentialDamagesWaiver: z.string().optional(),
            }),
            governingLaw: z.object({
              jurisdiction: z.string().optional(),
              venue: z.string().optional(),
              disputeResolution: z.string().optional(),
              arbitrationClause: z.string().optional(),
              classActionWaiver: z.boolean().optional(),
            }),
            compliance: z.object({
              applicableLaws: z.array(z.string()).optional(),
              dataProtection: z.string().optional(),
              auditRights: z.string().optional(),
              insuranceRequirements: z.string().optional(),
            }),
            assignment: z.object({
              assignableBy: z.string().optional(),
              restrictions: z.string().optional(),
              changeOfControl: z.string().optional(),
            }),
            waiverAndSeverability: z.object({
              waiver: z.string().optional(),
              severability: z.string().optional(),
              entireAgreement: z.boolean().optional(),
              amendments: z.string().optional(),
              forceMajeure: z.string().optional(),
              nonSolicitation: z.string().optional(),
              nonCompete: z.string().optional(),
            }),
            riskClauses: z.array(
              z.object({
                clause: z.string(),
                riskLevel: z.enum(["low", "medium", "high", "critical"]),
                explanation: z.string(),
                recommendedAction: z.string().optional(),
              })
            ),
            negotiationScore: z.object({
              overall: z
                .number()
                .min(1)
                .max(10)
                .describe("1=highly unfavorable, 10=highly favorable"),
              balance: z.string(),
              keyNegotiationPoints: z.array(z.string()),
            }),
            summary: z.string(),
            actionItems: z
              .array(z.string())
              .describe("Concrete recommended actions for the user"),
          }),
          prompt: `You are an expert contract analyst. Analyze the following contract text${context ? ` for a user who identifies as: ${context}` : ""}. Extract all key terms, obligations, risks, and actionable insights. Be thorough and precise. If a field is not found in the text, leave it empty or as appropriate defaults. Focus on flagging clauses that are unusual, one-sided, or potentially harmful. Provide a negotiation score from 1-10 where 10 is most favorable to the user.

Contract Text:
${contractText}`,
        });

        return { success: true, analysis: object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 2 — Compare Contracts
// =============================================================================

export const compareContracts = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Compare two versions of a contract side-by-side. Identifies additions, deletions, " +
      "modifications, and assesses their impact. Provides an overall risk delta and negotiation recommendations.",
    inputSchema: z.object({
      originalText: z.string().describe("The original/previous contract text"),
      newText: z.string().describe("The new/revised contract text"),
      context: z
        .string()
        .optional()
        .describe("Optional context about the user's position"),
    }),
    execute: async ({ originalText, newText, context }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const { object } = await generateObject({
          model,
          schema: z.object({
            sectionDiffs: z.array(
              z.object({
                section: z.string(),
                type: z.enum([
                  "addition",
                  "deletion",
                  "modification",
                  "unchanged",
                ]),
                original: z.string().optional(),
                revised: z.string().optional(),
                description: z.string(),
                impact: z.enum(["positive", "neutral", "negative", "mixed"]),
                riskLevel: z.enum(["low", "medium", "high"]).optional(),
              })
            ),
            overallChanges: z.object({
              totalChanges: z.number(),
              additions: z.number(),
              deletions: z.number(),
              modifications: z.number(),
            }),
            riskDelta: z.object({
              previousRiskLevel: z.enum(["low", "medium", "high"]),
              newRiskLevel: z.enum(["low", "medium", "high"]),
              improvedAspects: z.array(z.string()),
              worsenedAspects: z.array(z.string()),
            }),
            negotiationStrategy: z.object({
              recommendedStance: z.enum([
                "accept",
                "counter",
                "reject",
                "needs_discussion",
              ]),
              keyBattleItems: z.array(z.string()),
              fallbackPositions: z.array(z.string()).optional(),
            }),
            overallImpact: z.string(),
            recommendation: z.string(),
          }),
          prompt: `You are an expert contract negotiator. Compare the following two versions of the same contract${context ? ` for a user who is ${context}` : ""}. Identify ALL changes between the original and revised versions, categorize each change as addition, deletion, or modification, and assess the impact on the user. Provide specific recommendations.

Original Text:
${originalText}

New/Revised Text:
${newText}`,
        });

        return { success: true, comparison: object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 3 — Extract Clauses
// =============================================================================

export const extractClauses = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Extract specific types of clauses from a contract: NDA/confidentiality, " +
      "indemnification, termination, limitation of liability, governing law, " +
      "force majeure, assignment, non-compete, or all of them.",
    inputSchema: z.object({
      contractText: z.string().describe("The full text of the contract"),
      clauseTypes: z
        .array(
          z.enum([
            "confidentiality",
            "indemnification",
            "termination",
            "limitation_of_liability",
            "governing_law",
            "force_majeure",
            "assignment",
            "non_compete",
            "payment",
            "warranty",
            "insurance",
            "audit",
            "data_protection",
            "all",
          ])
        )
        .describe(
          "Which clause types to extract. Use 'all' to extract every clause type."
        ),
    }),
    execute: async ({ contractText, clauseTypes }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const extractAll = clauseTypes.includes("all");
        const { object } = await generateObject({
          model,
          schema: z.object({
            clauses: z.array(
              z.object({
                type: z.string(),
                title: z.string().optional(),
                text: z.string(),
                sectionReference: z.string().optional(),
                summary: z.string(),
                riskLevel: z.enum(["low", "medium", "high"]).optional(),
                suggestions: z.string().optional(),
              })
            ),
            missingClauses: z
              .array(z.string())
              .describe(
                "Standard clause types that appear to be missing from this contract"
              ),
          }),
          prompt: `Extract the following clause types from this contract${extractAll ? "EXTRACT ALL CLAUSE TYPES" : `: ${clauseTypes.join(", ")}`}. For each clause found, provide the full text, a brief summary, and any risk assessment. Also identify which standard clauses are MISSING.

Contract Text:
${contractText}`,
        });

        return { success: true, ...object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 4 — Compliance Check
// =============================================================================

export const complianceCheck = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Check a contract or legal document for compliance with major regulations: " +
      "GDPR, CCPA, HIPAA, SOC2, PCI-DSS, or general data protection principles. " +
      "Identifies clauses that comply, clauses that need modification, and missing requirements.",
    inputSchema: z.object({
      contractText: z
        .string()
        .describe("The contract or legal document to check"),
      frameworks: z
        .array(
          z.enum([
            "gdpr",
            "ccpa",
            "hipaa",
            "soc2",
            "pci_dss",
            "general_data_protection",
          ])
        )
        .describe("Compliance frameworks to check against"),
      businessType: z
        .string()
        .optional()
        .describe("Type of business (e.g. SaaS provider, healthcare, fintech)"),
    }),
    execute: async ({ contractText, frameworks, businessType }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const { object } = await generateObject({
          model,
          schema: z.object({
            overallCompliance: z.string(),
            frameworkResults: z.array(
              z.object({
                framework: z.string(),
                status: z.enum([
                  "compliant",
                  "partially_compliant",
                  "non_compliant",
                  "not_applicable",
                ]),
                score: z.number().min(0).max(100),
                compliantClauses: z.array(z.string()),
                nonCompliantClauses: z.array(
                  z.object({
                    clause: z.string(),
                    issue: z.string(),
                    remediation: z.string(),
                    priority: z.enum(["high", "medium", "low"]),
                  })
                ),
                missingRequirements: z.array(z.string()),
              })
            ),
            recommendedActions: z.array(z.string()),
          }),
          prompt: `You are a compliance expert. Check this contract for compliance with: ${frameworks.join(", ")}${businessType ? `\nBusiness type: ${businessType}` : ""}.
Provide a detailed compliance analysis with specific clause references and actionable remediation steps.

Contract Text:
${contractText}`,
        });

        return { success: true, compliance: object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 5 — Redline Contract (Suggest Modifications)
// =============================================================================

export const redlineContract = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Suggest redlines/modifications for unbalanced or risky terms in a contract. " +
      "Provides specific language changes, additions, and deletions organized by clause. " +
      "Useful when reviewing an unfavorable draft and preparing a counter-offer.",
    inputSchema: z.object({
      contractText: z.string().describe("The contract text to redline"),
      partyPerspective: z
        .enum([
          "buyer",
          "seller",
          "employee",
          "employer",
          "licensor",
          "licensee",
          "service_provider",
          "client",
          "neutral",
        ])
        .optional()
        .default("neutral")
        .describe("Your perspective in the contract"),
      aggressiveness: z
        .enum(["conservative", "moderate", "aggressive"])
        .optional()
        .default("moderate")
        .describe("How aggressive to be in proposed changes"),
      specificConcerns: z
        .string()
        .optional()
        .describe("Any specific concerns to focus on"),
    }),
    execute: async ({
      contractText,
      partyPerspective,
      aggressiveness,
      specificConcerns,
    }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const { object } = await generateObject({
          model,
          schema: z.object({
            summary: z.string(),
            proposedChanges: z.array(
              z.object({
                clause: z.string(),
                originalText: z.string(),
                proposedText: z.string(),
                reason: z.string(),
                priority: z.enum(["high", "medium", "low"]),
                riskAddressed: z.string(),
                negotiationTactic: z.string().optional(),
              })
            ),
            newClausesToAdd: z.array(
              z.object({
                title: z.string(),
                proposedText: z.string(),
                reason: z.string(),
                priority: z.enum(["high", "medium", "low"]),
              })
            ),
            clausesToRemove: z.array(
              z.object({
                clause: z.string(),
                reason: z.string(),
                riskIfRetained: z.string(),
              })
            ),
            fallbackPositions: z.array(
              z.object({
                issue: z.string(),
                idealPosition: z.string(),
                fallback: z.string(),
                walkAwayIssue: z.boolean(),
              })
            ),
          }),
          prompt: `You are an expert contract negotiator. Review this contract from the perspective of a ${partyPerspective} with ${aggressiveness} negotiation stance.${specificConcerns ? `\nSpecific concerns: ${specificConcerns}` : ""}
Provide specific redlines (proposed modifications) for unbalanced or risky clauses. For each change, show original text, proposed new text, and the reasoning. Also suggest new clauses to add and clauses to remove.

Contract Text:
${contractText}`,
        });

        return { success: true, redlines: object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 6 — Obligation Tracker
// =============================================================================

export const obligationTracker = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Extract all obligations, deadlines, and action items from a contract, organized by party. " +
      "Includes dates, conditions, and status tracking. Useful for post-signature compliance.",
    inputSchema: z.object({
      contractText: z.string().describe("The contract text to analyze"),
      effectiveDate: z
        .string()
        .optional()
        .describe(
          "The effective date of the contract (ISO format) for timeline calculations"
        ),
    }),
    execute: async ({ contractText, effectiveDate }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const { object } = await generateObject({
          model,
          schema: z.object({
            obligations: z.array(
              z.object({
                party: z.string(),
                obligation: z.string(),
                category: z.enum([
                  "payment",
                  "delivery",
                  "performance",
                  "reporting",
                  "compliance",
                  "notice",
                  "other",
                ]),
                deadline: z.string().optional(),
                conditionPrecedent: z.string().optional(),
                recurring: z.boolean(),
                frequency: z.string().optional(),
                status: z.enum([
                  "pending",
                  "ongoing",
                  "completed",
                  "triggered",
                ]),
                priority: z.enum(["high", "medium", "low"]),
                section: z.string().optional(),
              })
            ),
            deadlines: z.array(
              z.object({
                date: z.string(),
                description: z.string(),
                party: z.string(),
                consequenceOfMiss: z.string().optional(),
              })
            ),
            upcomingReminders: z
              .array(z.string())
              .describe(
                "Reminders for upcoming obligations based on the effective date"
              ),
            overallBurden: z.object({
              partyA: z.string().describe("First party name"),
              partyAObligationCount: z.number(),
              partyBObligationCount: z.number(),
              balanceAssessment: z.string(),
            }),
          }),
          prompt: `Extract ALL obligations, deadlines, and action items from this contract organized by party.${effectiveDate ? ` The contract effective date is ${effectiveDate}. Use this to calculate upcoming deadlines and reminders.` : ""}
Include payment schedules, delivery dates, reporting requirements, notice periods, and any conditional obligations. Assess the overall burden balance between parties.

Contract Text:
${contractText}`,
        });

        return { success: true, obligations: object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 7 — Jurisdiction Analysis
// =============================================================================

export const jurisdictionAnalysis = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Analyze the governing law, jurisdiction, and dispute resolution provisions " +
      "in a contract. Assesses enforceability risks, venue implications, and provides " +
      "strategic recommendations based on the parties' locations.",
    inputSchema: z.object({
      contractText: z.string().describe("The contract text to analyze"),
      userLocation: z
        .string()
        .optional()
        .describe("The user's country/state for conflict analysis"),
      counterpartyLocation: z
        .string()
        .optional()
        .describe("The counterparty's country/state"),
    }),
    execute: async ({ contractText, userLocation, counterpartyLocation }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const { object } = await generateObject({
          model,
          schema: z.object({
            governingLaw: z.object({
              selected: z.string().optional(),
              implications: z.string(),
              alternativeOptions: z.array(z.string()).optional(),
            }),
            jurisdiction: z.object({
              venue: z.string().optional(),
              exclusivity: z.string().optional(),
              enforceabilityRisk: z.enum(["low", "medium", "high"]),
              practicalConsiderations: z.string().optional(),
            }),
            disputeResolution: z.object({
              method: z.string(),
              arbitrationDetails: z.string().optional(),
              classActionWaiver: z.boolean().optional(),
              juryWaiver: z.boolean().optional(),
              costAllocation: z.string().optional(),
              timeline: z.string().optional(),
            }),
            conflictAnalysis: z.object({
              userFavorable: z.boolean().optional(),
              keyRisks: z.array(z.string()),
              crossBorderIssues: z.array(z.string()).optional(),
              enforcementLikelihood: z.string().optional(),
            }),
            recommendations: z.array(z.string()),
          }),
          prompt: `Analyze the governing law, jurisdiction, and dispute resolution provisions in this contract.${userLocation ? `\nUser location: ${userLocation}` : ""}${counterpartyLocation ? `\nCounterparty location: ${counterpartyLocation}` : ""}
Assess enforceability risks, practical implications of the chosen venue, and provide strategic recommendations.

Contract Text:
${contractText}`,
        });

        return { success: true, analysis: object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 8 — Risk Scoring
// =============================================================================

export const riskScoring = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Generate a comprehensive risk score for a contract with per-clause breakdown. " +
      "Evaluates liability, termination, IP, confidentiality, payment, and compliance risks. " +
      "Returns an overall score (0-100) with prioritized recommendations.",
    inputSchema: z.object({
      contractText: z.string().describe("The contract text to score"),
      userRole: z
        .string()
        .optional()
        .describe("The user's role/position relative to the contract"),
    }),
    execute: async ({ contractText, userRole }) => {
      try {
        const model = getLanguageModel("anthropic/claude-sonnet-4.5");
        const { object } = await generateObject({
          model,
          schema: z.object({
            overallScore: z
              .number()
              .min(0)
              .max(100)
              .describe("0=extremely risky, 100=completely safe"),
            overallVerdict: z.string(),
            categoryScores: z.array(
              z.object({
                category: z.string(),
                score: z.number().min(0).max(100),
                weight: z
                  .number()
                  .min(1)
                  .max(5)
                  .describe("Importance weight 1-5"),
                findings: z.array(z.string()),
                riskLevel: z.enum([
                  "critical",
                  "high",
                  "medium",
                  "low",
                  "minimal",
                ]),
              })
            ),
            criticalIssues: z.array(
              z.object({
                issue: z.string(),
                clause: z.string().optional(),
                impact: z.string(),
                urgency: z.enum([
                  "immediate",
                  "before_signing",
                  "before_accepting",
                ]),
                recommendation: z.string(),
              })
            ),
            dealBreakers: z.array(z.string()),
            recommendedNextSteps: z.array(z.string()),
          }),
          prompt: `You are an expert risk assessment analyst. Score this contract for overall risk${userRole ? ` from the perspective of a ${userRole}` : ""}. Evaluate each risk category independently, assign weights based on importance, and provide a final weighted score from 0-100 (0=extremely risky, 100=completely safe). Flag any deal-breakers and provide prioritized recommendations.

Contract Text:
${contractText}`,
        });

        return { success: true, riskScore: object };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// EXPORT ALL — 8 tools
// =============================================================================

export const allLegalTools = (ctx: { userId: string }) => ({
  analyzeContract: analyzeContract(ctx),
  compareContracts: compareContracts(ctx),
  extractClauses: extractClauses(ctx),
  complianceCheck: complianceCheck(ctx),
  redlineContract: redlineContract(ctx),
  obligationTracker: obligationTracker(ctx),
  jurisdictionAnalysis: jurisdictionAnalysis(ctx),
  riskScoring: riskScoring(ctx),
});
