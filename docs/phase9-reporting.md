# Phase 9 reporting

Reports use the authenticated Expo Supabase client and existing RLS policies.
Administrators receive municipality/city-wide data. BSI reports are fixed to
the signed-in BSI and assigned barangay; the UI cannot select another barangay.
No service-role credential or public report URL is used.

## Metric definitions

- Current place-risk counts use `places.risk_level`, representing the latest
  authoritative inspection protected by the stale-inspection rule.
- Inspection registers use historical risk values stored on each inspection.
- Result and activity counts honor the selected reporting period.
- Initial inspection is the earliest ordinary inspection for a place; linked
  follow-ups are reinspections and later unlinked records are regular
  inspections.
- Overdue means a pending reinspection whose scheduled date/time is before the
  current time. It is derived for reporting, not stored as a new status.
- Compliance rate is compliant inspections divided by all matching inspections
  in the selected period.
- Reinspection completion rate is completed divided by matching pending plus
  completed reinspections.
- BSI activity is operational only. It contains no ratings, ranks, or grades.

## Preview and export

One report view model drives both the mobile preview and PDF so labels, metrics,
filters, summary rows, checklist matrices, findings, remarks, and evidence remain
consistent. Consolidated previews use horizontally scrollable matrices with one
inspection per row. PDF export reloads the filtered dataset up to a mobile
safety limit of 500 rows instead of exporting only the visible page. If more
records match, the report states the included and total counts.

Consolidated PDFs use A4 landscape with small margins and repeated table headers.
The complete checklist is split into two readable matrices: Safe Water Supply,
then Sanitation Facility & Assessment. Findings, remarks, and optional evidence
are separate sections tied to the same exported inspections. Reinspection
reports split original and follow-up matrices. Photo evidence is optional for
broad reports and enabled by default for the priority report. Files are generated
in the app cache and passed only to the native share sheet. They are not uploaded
to Supabase and do not print UUIDs, raw JSON, signed URLs, Storage/local paths,
authentication data, or sync internals.

Admin-generated reports do not contain signing blocks. BSI-generated reports
end with printed Prepared by and Received / Reviewed by spaces. These are paper
signature areas only and are not digital signatures.

Admin and BSI reporting require connectivity. Existing offline BSI inspection
capture and synchronization behavior is unchanged.

## Full inspection records

Admin and BSI inspection-detail screens can export an individual A4 Sanitary
Inspection Record. The record is loaded through the authenticated Supabase
client, so the existing Admin and barangay RLS scopes remain authoritative. It
contains place and inspection information, the complete recorded checklist,
derived SMDWS/Basic Sanitation Facility/SMSS results, findings, remarks,
reinspection information, and a printed representative acknowledgment area.
BSI exports additionally include the BSI/Admin printed submission signature
blocks; Admin exports do not.

Evidence is grouped with its finding. Each private object receives a short-lived
signed URL, is downloaded to the Expo cache, embedded in the PDF as an image
data URI, and removed from cache after conversion. An unavailable image produces
an explicit placeholder without failing the rest of the record. Signed URLs,
Storage paths, local paths, and internal identifiers are never printed.
