import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import type { ListingSearchRequest, ListingSearchResponse } from "@/lib/search";
import type { PropertyListing, RecommendationRequest } from "@/types/api";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const OPENCLAW_FETCH_LISTINGS_PATH =
  "/Users/account_clawteam7/.openclaw/workspace/skills/fetch-listings.js";
const OPENCLAW_TIMEOUT_MS = 120_000;
const RATE_LIMIT_MESSAGE =
  "Realtor.ca rate-limited the live listing search. Wait a minute and try again, or use demo search.";

type ExecFileError = Error & {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeListing(
  raw: Record<string, unknown>,
  fallbackArea: string,
): PropertyListing | null {
  const listing =
    raw.listing && typeof raw.listing === "object"
      ? (raw.listing as Record<string, unknown>)
      : raw;
  const address =
    listing.address && typeof listing.address === "object"
      ? (listing.address as Record<string, unknown>)
      : {};
  const price = asNumber(listing.listingPrice ?? listing.listing_price ?? listing.price);

  if (!price) {
    return null;
  }

  const id = String(
    listing.id ?? listing.mlsNumber ?? listing.mls_number ?? listing.url ?? `${fallbackArea}-${price}`,
  );

  return {
    id,
    url: typeof listing.url === "string" ? listing.url : null,
    mls_number:
      typeof listing.mlsNumber === "string"
        ? listing.mlsNumber
        : typeof listing.mls_number === "string"
          ? listing.mls_number
          : null,
    listing_price: Math.round(price),
    location: {
      address:
        typeof address.text === "string"
          ? address.text
          : typeof listing.address === "string"
            ? listing.address
            : null,
      city:
        typeof address.city === "string"
          ? address.city
          : typeof listing.city === "string"
            ? listing.city
            : fallbackArea,
      province:
        typeof address.province === "string"
          ? address.province
          : typeof listing.province === "string"
            ? listing.province
            : null,
      postal_code:
        typeof address.postalCode === "string"
          ? address.postalCode
          : typeof address.postal_code === "string"
            ? address.postal_code
            : null,
      latitude: typeof address.latitude === "number" ? address.latitude : null,
      longitude: typeof address.longitude === "number" ? address.longitude : null,
    },
    description: typeof listing.description === "string" ? listing.description : null,
    photo_urls: Array.isArray(listing.photoUrls)
      ? listing.photoUrls.filter((url): url is string => typeof url === "string")
      : Array.isArray(listing.photo_urls)
        ? listing.photo_urls.filter((url): url is string => typeof url === "string")
        : [],
    bedrooms: asNumber(listing.bedrooms) ?? null,
    bathrooms: asNumber(listing.bathrooms) ?? null,
    square_feet: asNumber(listing.squareFeet ?? listing.square_feet) ?? null,
    year_built: asNumber(listing.yearBuilt ?? listing.year_built) ?? null,
    property_type:
      typeof listing.propertyType === "string"
        ? listing.propertyType
        : typeof listing.property_type === "string"
          ? listing.property_type
          : null,
    annual_property_tax: asNumber(listing.annualPropertyTax ?? listing.annual_property_tax) ?? null,
    maintenance_fees:
      typeof listing.maintenanceFees === "string"
        ? listing.maintenanceFees
        : typeof listing.maintenance_fees === "string"
          ? listing.maintenance_fees
          : null,
  };
}

function outputToString(output: string | Buffer | undefined): string {
  return typeof output === "string" ? output : output?.toString("utf8") ?? "";
}

function openClawErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "OpenClaw listing search failed.";
  }

  const execError = error as ExecFileError;
  const output = `${outputToString(execError.stderr)}\n${outputToString(execError.stdout)}`.trim();
  const message = output || error.message;

  if (message.includes("HTTP 429")) {
    return RATE_LIMIT_MESSAGE;
  }

  return message.replace(/^Command failed:.*(?:\n|$)/, "").trim() || "OpenClaw listing search failed.";
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOpenClawArea(
  area: string,
  body: ListingSearchRequest,
): Promise<PropertyListing[]> {
  const args = {
    area,
    source: "realtor.ca",
    maxPrice: body.budget,
    beds: body.bedrooms,
    limit: 8,
  };

  const { stdout } = await execFileAsync(
    "node",
    [OPENCLAW_FETCH_LISTINGS_PATH, JSON.stringify(args)],
    { maxBuffer: 1024 * 1024 * 10, timeout: OPENCLAW_TIMEOUT_MS },
  );
  const payload = JSON.parse(stdout) as Record<string, unknown>;

  if (payload.error) {
    throw new Error(typeof payload.message === "string" ? payload.message : "OpenClaw failed.");
  }

  const listings = Array.isArray(payload.listings)
    ? payload.listings
    : Array.isArray(payload.properties)
      ? payload.properties
      : [];

  return listings
    .filter(
      (listing): listing is Record<string, unknown> =>
        typeof listing === "object" && listing !== null,
    )
    .map((listing) => normalizeListing(listing, area))
    .filter((listing): listing is PropertyListing => Boolean(listing));
}

async function runOpenClawSearch(body: ListingSearchRequest): Promise<ListingSearchResponse> {
  const areas = body.locations?.length > 0 ? body.locations : ["Toronto"];
  const batches: PropertyListing[][] = [];
  for (const [index, area] of areas.entries()) {
    if (index > 0) {
      await wait(1_500);
    }
    batches.push(await runOpenClawArea(area, body));
  }

  const byId = new Map<string, PropertyListing>();
  for (const property of batches.flat()) {
    byId.set(property.id, property);
  }

  const properties = [...byId.values()];
  return {
    properties,
    source: "live",
    summary: `OpenClaw found ${properties.length} listing${properties.length === 1 ? "" : "s"} across ${areas.join(", ")}.`,
  };
}

async function runDemoSearch(body: ListingSearchRequest): Promise<ListingSearchResponse> {
  function normalize(value: string | null | undefined): string {
    return value?.trim().toLowerCase() ?? "";
  }

  function locationMatches(city: string | null | undefined, locations: string[]): boolean {
    if (locations.length === 0) {
      return true;
    }

    const normalizedCity = normalize(city);
    return locations.some((location) => normalizedCity.includes(normalize(location)));
  }

  const demoPath = path.join(process.cwd(), "public", "demo_request.json");
  const demo = JSON.parse(await readFile(demoPath, "utf8")) as RecommendationRequest;
  const locations = body.locations ?? [];

  const strictMatches = (demo.properties ?? []).filter((property) => {
    const withinBudget = property.listing_price <= body.budget;
    const enoughBedrooms = !body.bedrooms || (property.bedrooms ?? 0) >= body.bedrooms;
    const inLocation = locationMatches(property.location?.city, locations);

    return withinBudget && enoughBedrooms && inLocation;
  });

  const properties = strictMatches.length > 0 ? strictMatches : demo.properties ?? [];
  const summary =
    strictMatches.length > 0
      ? `Found ${strictMatches.length} matching demo homes for ${locations.join(", ") || "your areas"}.`
      : "No exact demo matches, so HomePilot broadened the search to show nearby candidates.";

  const payload: ListingSearchResponse = {
    properties,
    source: "demo",
    summary,
  };

  return payload;
}

export async function POST(request: Request) {
  let body: ListingSearchRequest;

  try {
    body = (await request.json()) as ListingSearchRequest;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
  }

  if (body.useDemo) {
    return NextResponse.json(await runDemoSearch(body));
  }

  try {
    return NextResponse.json(await runOpenClawSearch(body));
  } catch (error) {
    return NextResponse.json(
      {
        detail: openClawErrorMessage(error),
      },
      { status: 502 },
    );
  }
}
