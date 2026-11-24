import type { Metadata } from "next"
import { Building2Icon, DownloadIcon, ExternalLinkIcon } from "lucide-react"

import { BackendDown, District, EmptyState, PageHeader } from "@/components/page-header"
import { UploadListings } from "@/components/upload-listings"
import { api, getSession } from "@/lib/api"
import type { Listing } from "@/lib/leads"

export const metadata: Metadata = { title: "Listings" }

const TEMPLATE = [
  "ref,title,deal,property_type,location,price,details,link",
  "SR-101,Lake View apartment,sale,2-bed apartment,Riverside,450000,Park facing; 2 parking,https://example.com/sr-101",
  "SR-102,Hill Villa,sale,Villa,North Hills,1.25M,Private garden,",
  "SR-201,Studio near metro,rent,1-bed apartment,Downtown,2500,Furnished,",
].join("\n")

export default async function ListingsPage() {
  const owner = (await getSession())?.role === "owner"
  let listings: Listing[] | null = null
  try {
    listings = await api<Listing[]>("/api/listings")
  } catch (e) {
    console.error(e)
  }
  const sale = listings?.filter((l) => l.deal === "sale").length ?? 0

  return (
    <main className="mx-auto w-full max-w-[1760px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Listings"
        description={
          listings?.length
            ? `${listings.length} properties · ${sale} for sale · ${listings.length - sale} for rent. The AI suggests matching ones in each reply.`
            : "Your available properties. The AI suggests matching ones in each reply."
        }
      >
        {owner && <UploadListings />}
      </PageHeader>

      {listings === null ? (
        <BackendDown />
      ) : listings.length === 0 ? (
        <EmptyState icon={<Building2Icon />} title="No listings yet">
          {owner ? (
            <>
              Upload your inventory as a CSV (export it from Excel or Google Sheets). Columns: ref, title, deal (sale or rent),
              property_type, location, price, details, link. Prices like 450000, 450k or 1.25M work, in your agency&apos;s currency.
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
                download="leaddesk-listings-template.csv"
                className="mt-4 flex items-center justify-center gap-1.5 font-medium text-primary hover:underline"
              >
                <DownloadIcon className="size-4" /> Download a template
              </a>
            </>
          ) : (
            "Ask the agency owner to upload the current listings."
          )}
        </EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Area</th>
                  <th className="px-4 py-3 font-medium">Deal</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {listings.map((l) => (
                  <tr key={l.ref} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {l.link ? (
                          <a href={l.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary hover:underline">
                            {l.title} <ExternalLinkIcon className="size-3.5" />
                          </a>
                        ) : (
                          l.title
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.ref}
                        {l.property_type && ` · ${l.property_type}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <District>{l.location}</District>
                    </td>
                    <td className="px-4 py-3">{l.deal === "sale" ? "Sale" : "Rent"}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {l.price_label}
                      {l.deal === "rent" && <span className="font-normal text-muted-foreground">/mo</span>}
                    </td>
                    <td className="max-w-md px-4 py-3 text-muted-foreground">{l.details ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {owner && (
            <p className="text-sm text-muted-foreground">
              To update, upload the full sheet again: rows are matched by ref, and properties missing from the sheet are removed (sold or
              let).{" "}
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
                download="leaddesk-listings-template.csv"
                className="font-medium text-primary hover:underline"
              >
                Download the template
              </a>
            </p>
          )}
        </>
      )}
    </main>
  )
}
