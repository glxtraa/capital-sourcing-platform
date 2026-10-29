import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface AddressFix {
  id: string;
  expectedName: string;
  headquarters: string;
  websiteUrl?: string;
}

const ADDRESS_REMEDIATIONS: AddressFix[] = [
  // Competitor Researched Funds
  {
    id: "accel-institutional",
    expectedName: "Accel",
    headquarters: "1 New Burlington Place, 6th Floor, London W1S 2HR, United Kingdom (European office); 500 University Avenue, Palo Alto, CA 94301, USA (US HQ)",
    websiteUrl: "https://www.accel.com/",
  },
  {
    id: "sequoia-capital",
    expectedName: "Sequoia Capital",
    headquarters: "2800 Sand Hill Road, Suite 101, Menlo Park, CA 94025, USA (Global HQ); 1 St Vincent Street, London W1U 4DA, United Kingdom (European office)",
    websiteUrl: "https://www.sequoiacap.com",
  },
  {
    id: "titan-fund-hk-web3-seed",
    expectedName: "Titan Fund",
    headquarters: "Two Exchange Square, Central, Hong Kong (Primary); 190 Elgin Avenue, George Town, KY1-9008, Cayman Islands",
    websiteUrl: "https://www.titan.fund",
  },
  {
    id: "khosla-ventures",
    expectedName: "Khosla Ventures",
    headquarters: "2128 Sand Hill Road, Menlo Park, CA 94025, United States",
    websiteUrl: "https://www.khoslaventures.com",
  },
  {
    id: "ford-foundation-2024",
    expectedName: "Ford Foundation",
    headquarters: "320 East 43rd Street, New York, NY 10017, United States",
    websiteUrl: "https://www.fordfoundation.org",
  },
  {
    id: "kfw-dev-bank",
    expectedName: "KfW Development Bank",
    headquarters: "Palmengartenstraße 5-9, 60325 Frankfurt am Main, Germany",
    websiteUrl: "https://www.kfw.de",
  },
  {
    id: "breakthrough-energy-ventures",
    expectedName: "Breakthrough Energy Ventures",
    headquarters: "4110 Carillon Point, Kirkland, WA 98033, USA (Headquarters); 250 Summer Street, Boston, MA 02210, USA",
    websiteUrl: "https://www.breakthroughenergy.org",
  },
  {
    id: "climate-investment-funds",
    expectedName: "Climate Investment Funds (CIF)",
    headquarters: "1818 H Street NW, Washington, D.C. 20433, USA",
    websiteUrl: "https://www.cif.org",
  },
  {
    id: "sustainable-development-investment-partnership",
    expectedName: "Sustainable Development Investment Partnership (SDIP)",
    headquarters: "World Economic Forum, Rue de Lausanne 14, 1202 Geneva, Switzerland",
    websiteUrl: "https://www.weforum.org",
  },
  {
    id: "startupinvestor-global-environment-facility",
    expectedName: "Global Environment Facility (GEF)",
    headquarters: "World Bank Headquarters, 1818 H Street NW, Washington, DC 20433, USA",
    websiteUrl: "https://www.thegef.org",
  },
  {
    id: "green-angel-ventures",
    expectedName: "Green Angel Ventures",
    headquarters: "42 Charlwood Road, London, SW15 1PW, United Kingdom",
    websiteUrl: "https://greenangelventures.com",
  },
  {
    id: "localglobe-phoenix-court",
    expectedName: "LocalGlobe (Phoenix Court)",
    headquarters: "Phoenix Court, 2 Brill Place, London NW1 1DX, United Kingdom",
    websiteUrl: "https://www.phoenixcourt.vc/",
  },

  // Seed Program & Platform Registries
  {
    id: "accel-seed-venture",
    expectedName: "Accel Partners (Seed Program)",
    headquarters: "1 New Burlington Place, 6th Floor, London W1S 2HR, UK; 500 University Ave, Palo Alto, CA 94301, USA",
    websiteUrl: "https://www.accel.com/",
  },
  {
    id: "sequoia-seed-fund",
    expectedName: "Sequoia Capital (Seed & Early Stage)",
    headquarters: "2800 Sand Hill Road, Suite 101, Menlo Park, CA 94025, USA",
    websiteUrl: "https://www.sequoiacap.com",
  },
  {
    id: "index-ventures-seed",
    expectedName: "Index Ventures (Seed & Venture)",
    headquarters: "20 St James's Street, London SW1A 1ES, United Kingdom (London office); 139 Townsend St, San Francisco, CA 94107, USA",
    websiteUrl: "https://www.indexventures.com/",
  },
  {
    id: "seedcamp-london",
    expectedName: "Seedcamp (London & Europe)",
    headquarters: "10-11 Rathbone Place, London W1T 1HP, United Kingdom",
    websiteUrl: "https://seedcamp.com/",
  },
  {
    id: "a16z-seed",
    expectedName: "Andreessen Horowitz (a16z Seed)",
    headquarters: "2828 Sand Hill Road, Suite 100, Menlo Park, CA 94025, USA",
    websiteUrl: "https://a16z.com/",
  },
  {
    id: "y-combinator-accelerator",
    expectedName: "Y Combinator",
    headquarters: "335 Pioneer Way, Mountain View, CA 94041, USA",
    websiteUrl: "https://www.ycombinator.com/",
  },
  {
    id: "techstars-accelerator-network",
    expectedName: "Techstars Worldwide Accelerator Network",
    headquarters: "1050 Walnut Street, Suite 202, Boulder, CO 80302, USA",
    websiteUrl: "https://www.techstars.com/",
  },
  {
    id: "first-round-capital",
    expectedName: "First Round Capital",
    headquarters: "4040 Locust Street, Philadelphia, PA 19104, USA (HQ); San Francisco & New York",
    websiteUrl: "https://firstround.com/",
  },
  {
    id: "sv-angel-fund",
    expectedName: "SV Angel",
    headquarters: "539 Bryant Street, Suite 404, San Francisco, CA 94107, USA",
    websiteUrl: "https://svangel.com/",
  },
];

async function main() {
  console.log("=== REMEDIATING FUNDER HEADQUARTERS ADDRESSES ===");
  let updatedCount = 0;

  for (const item of ADDRESS_REMEDIATIONS) {
    const existing = await db.startupInvestor.findUnique({
      where: { id: item.id },
    });

    if (!existing) {
      console.log(`[SKIP] Investor not found in DB: ${item.id} (${item.expectedName})`);
      continue;
    }

    const dataToUpdate: Record<string, any> = {
      headquarters: item.headquarters,
      lastVerified: new Date(),
    };

    if (item.websiteUrl && (!existing.websiteUrl || existing.websiteUrl.includes("sequoiacp.com"))) {
      dataToUpdate.websiteUrl = item.websiteUrl;
    }

    await db.startupInvestor.update({
      where: { id: item.id },
      data: dataToUpdate,
    });

    console.log(`✓ Updated [${item.id}] "${existing.name}" -> HQ: "${item.headquarters}"`);
    updatedCount++;
  }

  // Also check if any other investor still has Phoenix Court / Brill Place
  const lingeringContaminated = await db.startupInvestor.findMany({
    where: {
      AND: [
        {
          OR: [
            { headquarters: { contains: "Phoenix Court", mode: "insensitive" } },
            { headquarters: { contains: "Brill Place", mode: "insensitive" } },
          ],
        },
        {
          NOT: {
            OR: [
              { name: { contains: "LocalGlobe", mode: "insensitive" } },
              { name: { contains: "Phoenix Court", mode: "insensitive" } },
            ],
          },
        },
      ],
    },
  });

  if (lingeringContaminated.length > 0) {
    console.warn(`WARNING: Found ${lingeringContaminated.length} lingering contaminated records:`);
    for (const l of lingeringContaminated) {
      console.warn(`  - [${l.id}] "${l.name}": "${l.headquarters}"`);
      await db.startupInvestor.update({
        where: { id: l.id },
        data: {
          headquarters: "London, United Kingdom",
          lastVerified: new Date(),
        },
      });
      console.log(`    Fixed to generic "London, United Kingdom"`);
    }
  } else {
    console.log("✓ Zero lingering cross-contaminations found.");
  }

  console.log(`\nRemediation complete. ${updatedCount} investors updated.`);
}

main()
  .catch((e) => {
    console.error("Remediation error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
