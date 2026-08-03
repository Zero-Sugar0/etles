import { Redis } from "@upstash/redis";
import { generateUUID } from "@/lib/utils";

function getRedis() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }

  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export async function seedBusinessFramework(userId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    console.warn(
      "[seedBusinessFramework] Redis not configured, skipping seed."
    );
    return false;
  }
  // `const` carries the non-null narrowing into the nested closures below.
  const r: Redis = redis;

  const seededMarkerKey = `kg:${userId}:seeded:business-framework`;
  const isAlreadySeeded = await redis.get(seededMarkerKey);
  if (isAlreadySeeded) {
    return true; // Already seeded
  }

  const now = new Date().toISOString();

  async function createEntity(data: {
    name: string;
    entityType: string;
    summary: string;
    tags: string[];
    aliases: string[];
    facts: string[];
  }): Promise<string> {
    const id = `entity_${generateUUID()}`;
    const entity = {
      id,
      name: data.name,
      entityType: data.entityType,
      summary: data.summary,
      tags: data.tags,
      aliases: data.aliases,
      facts: data.facts,
      createdAt: now,
      updatedAt: now,
    };

    await r.set(`kg:${userId}:entity:${id}`, JSON.stringify(entity));
    await r.sadd(`kg:${userId}:entities`, id);
    return id;
  }

  async function createRelation(data: {
    fromEntityId: string;
    toEntityId: string;
    relationType: string;
    weight: number;
    evidence?: string;
  }) {
    const id = `rel_${generateUUID()}`;
    const relation = {
      id,
      fromEntityId: data.fromEntityId,
      toEntityId: data.toEntityId,
      relationType: data.relationType,
      weight: data.weight,
      evidence: data.evidence,
      createdAt: now,
    };

    await r.set(`kg:${userId}:relation:${id}`, JSON.stringify(relation));
    await r.sadd(`kg:${userId}:relations`, id);
    await r.sadd(`kg:${userId}:out:${data.fromEntityId}`, id);
    await r.sadd(`kg:${userId}:in:${data.toEntityId}`, id);
  }

  try {
    // 1. BUSINESS MODEL CANVAS (BMC) ENTITIES
    const bmcHeaderId = await createEntity({
      name: "Business Model Canvas",
      entityType: "framework",
      summary:
        "Strategic management template for developing new or documenting existing business models.",
      tags: ["framework", "strategy", "bmc", "business-operations"],
      aliases: ["BMC", "Business Canvas"],
      facts: [
        "Consists of 9 core building blocks.",
        "Used by C-Suite executive agents to align value propositions with customer segments.",
      ],
    });

    const valPropId = await createEntity({
      name: "Value Proposition",
      entityType: "bmc_block",
      summary:
        "The collection of products and services a business offers to meet the needs of its customers.",
      tags: ["bmc", "value-prop", "strategy"],
      aliases: ["Offerings", "Core Value"],
      facts: [
        "Solves customer pain points and delivers unique value.",
        "Differentiates the business from competitors.",
      ],
    });

    const custSegId = await createEntity({
      name: "Customer Segments",
      entityType: "bmc_block",
      summary:
        "The different groups of people or organizations an enterprise aims to reach and serve.",
      tags: ["bmc", "customers", "target-audience"],
      aliases: ["ICP", "Target Market"],
      facts: [
        "Defines Ideal Customer Profiles (ICP) for outbound SDRs.",
        "Drives marketing and sales channel targeting.",
      ],
    });

    const revStreamId = await createEntity({
      name: "Revenue Streams",
      entityType: "bmc_block",
      summary: "The cash a company generates from each customer segment.",
      tags: ["bmc", "finance", "revenue"],
      aliases: ["Monetization", "Pricing Models"],
      facts: [
        "Includes SaaS subscriptions, usage-based fees, and enterprise contracts.",
        "Monitored by Finance Lead and Deal Desk.",
      ],
    });

    const costStructId = await createEntity({
      name: "Cost Structure",
      entityType: "bmc_block",
      summary: "All costs incurred to operate a business model.",
      tags: ["bmc", "finance", "costs"],
      aliases: ["OPEX", "CAPEX", "Expenses"],
      facts: [
        "Includes cloud infrastructure, payroll, marketing spend, and vendor software.",
        "Audited by CFO and Cloud Cost Optimizer.",
      ],
    });

    // Relate BMC Header to Blocks
    await createRelation({
      fromEntityId: bmcHeaderId,
      toEntityId: valPropId,
      relationType: "contains_component",
      weight: 1.0,
    });
    await createRelation({
      fromEntityId: bmcHeaderId,
      toEntityId: custSegId,
      relationType: "contains_component",
      weight: 1.0,
    });
    await createRelation({
      fromEntityId: bmcHeaderId,
      toEntityId: revStreamId,
      relationType: "contains_component",
      weight: 1.0,
    });
    await createRelation({
      fromEntityId: bmcHeaderId,
      toEntityId: costStructId,
      relationType: "contains_component",
      weight: 1.0,
    });

    // 2. KPI TREE ENTITIES & RELATIONS
    const arrId = await createEntity({
      name: "Annual Recurring Revenue (ARR)",
      entityType: "metric",
      summary:
        "Annualized value of recurring revenue from active SaaS subscriptions.",
      tags: ["kpi", "finance", "growth", "saas"],
      aliases: ["ARR", "Run-rate Revenue"],
      facts: ["Top-line financial growth metric.", "Calculated as MRR * 12."],
    });

    const cacId = await createEntity({
      name: "Customer Acquisition Cost (CAC)",
      entityType: "metric",
      summary:
        "Total cost of sales and marketing required to acquire a single paying customer.",
      tags: ["kpi", "marketing", "sales", "finance"],
      aliases: ["CAC", "Acquisition Cost"],
      facts: [
        "Monitored by Marketing Lead and Growth Hacker.",
        "Target payback period: < 12 months.",
      ],
    });

    const ltvId = await createEntity({
      name: "Lifetime Value (LTV)",
      entityType: "metric",
      summary:
        "Total revenue a business expects to earn from a single customer over their lifetime.",
      tags: ["kpi", "customer-success", "finance"],
      aliases: ["LTV", "CLV"],
      facts: [
        "Target LTV:CAC ratio is > 3:1.",
        "Directly impacted by churn rate and expansion ARR.",
      ],
    });

    const nrrId = await createEntity({
      name: "Net Revenue Retention (NRR)",
      entityType: "metric",
      summary:
        "Percentage of recurring revenue retained from existing customers over a period.",
      tags: ["kpi", "customer-success", "retention"],
      aliases: ["NRR", "Net Dollar Retention"],
      facts: [
        "Benchmark target > 110% for high-growth B2B SaaS.",
        "Owned by CCO / Customer Service Lead.",
      ],
    });

    // Causal Links in KPI Tree
    await createRelation({
      fromEntityId: cacId,
      toEntityId: ltvId,
      relationType: "feeds_into",
      weight: 0.9,
      evidence: "CAC efficiency dictates LTV return threshold",
    });
    await createRelation({
      fromEntityId: nrrId,
      toEntityId: arrId,
      relationType: "drives_growth",
      weight: 0.95,
      evidence:
        "High NRR compounds ARR compounding without net new acquisition",
    });
    await createRelation({
      fromEntityId: revStreamId,
      toEntityId: arrId,
      relationType: "monetizes",
      weight: 1.0,
    });

    // 3. OKR & WBR TEMPLATES
    const okrTemplateId = await createEntity({
      name: "Company OKR Template",
      entityType: "template",
      summary:
        "Quarterly Objectives and Key Results framework for cascading company goals into department targets.",
      tags: ["okr", "management", "strategy"],
      aliases: ["OKR Framework"],
      facts: [
        "Objective: High-impact, qualitative goal.",
        "Key Results: 3-5 quantitative metrics to measure success.",
        "Reviewed bi-weekly by Chief of Staff and CEO Lead.",
      ],
    });

    const wbrTemplateId = await createEntity({
      name: "Weekly Business Review (WBR) Scorecard",
      entityType: "template",
      summary:
        "Weekly scorecard structure for reviewing revenue performance, pipeline, active incidents, and operational bottlenecks.",
      tags: ["wbr", "reporting", "c-suite"],
      aliases: ["WBR", "Weekly Briefing"],
      facts: [
        "Sections: Revenue vs Plan, Sales Pipeline, Retention & Support Tickets, Engineering Incidents, Cash Runway.",
        "Synthesized by Chief of Staff every Monday.",
      ],
    });

    await createRelation({
      fromEntityId: bmcHeaderId,
      toEntityId: okrTemplateId,
      relationType: "guides_planning",
      weight: 0.8,
    });
    await createRelation({
      fromEntityId: bmcHeaderId,
      toEntityId: wbrTemplateId,
      relationType: "tracks_execution",
      weight: 0.8,
    });

    // Mark as seeded in Redis
    await redis.set(seededMarkerKey, "true");
    console.log(
      `[seedBusinessFramework] Successfully seeded Business Model Canvas, KPI Tree, and OKR/WBR templates for user ${userId}.`
    );
    return true;
  } catch (error) {
    console.error(
      "[seedBusinessFramework] Failed to seed business framework:",
      error
    );
    return false;
  }
}
