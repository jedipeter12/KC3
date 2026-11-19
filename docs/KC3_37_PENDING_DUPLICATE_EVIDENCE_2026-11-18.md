# KC3-37 Pending duplicate evidence: Dinh Tea and Oak Park

Observed 2026-11-18 (America/Chicago). This is a four-row research packet for
`outputs/01a1cd62-c09b-72f2-b4cc-235c908e8f22/KC3_Overture_Review_decisions.xlsx`
(SHA-256 `94df86a101473e1067ca53ddcc5e1854992abd6987be8084bf85ea4eb015fd2d`).
The workbook was read only. `P` means a Places sheet row; the Overture UUID,
not the row number, is the durable source key. All four Places and Hours rows
remain **Pending**. No workbook edit, private stage, or real publication follows
from this packet. The earlier [Ready audit](KC3_37_READY_EVIDENCE_AUDIT_2026-11-11.md)
identified these two same-address pairs; this packet tests their unresolved
identity and category claims against current primary pages.

| Rows / source UUIDs | Bounded evidence and disposition for attended review |
| --- | --- |
| P23 `253328e8-0e2f-4f7c-86b3-8e33be9063f4` (`boba_tea`) and P24 `fcd95ce7-8c34-4ddd-a977-d4230793a4d1` (`coffee_shop`) | Both workbook rows have the same name, `12236 W 95th St`, and exact point `38.957244873046875, -94.72764587402344`; only type and source ID differ. [The operator](https://www.dinhteaandcoffeeop.com/) describes **one** Dinh Tea and Coffee Shop at Unit A in Lenexa, with both coffee and bubble tea. [Lenexa Chamber](https://www.lenexa.org/convention-and-visitors-bureau/restaurants/) lists one shop at that address under Coffee & Tea. This supports one physical business and customer access, but does not select the primary KC3 category or adjudicate which Overture ID has better provenance. Hold both source rows Pending; choose at most one ID only after category, source lineage, point, and duplicate review. Do not allocate two KC3 IDs. |
| P303 `f876f53d-6580-47a3-b569-b2f694219f58` (`Green Way Park`) and P356 `20132ec0-2b72-4111-b0d4-2b2c2227c2dc` (`Oak Park`) | Both workbook rows use `11506 W 106th St`, Overland Park, but their points differ (P303 `38.93657684326172, -94.72064208984375`; P356 `38.93956756591797, -94.7210464477539`). [Visit Overland Park](https://www.visitoverlandpark.com/directory/oak-park/) names an Oak Park at that address and describes a wooded neighborhood play park. [The city's park index](https://www.opkansas.gov/parks) lists Oak Park. These support P356 as the named park candidate and public access, but the address alone cannot prove P303 is an alias: the points are distinct within an extended park setting. Keep P303 Pending for footprint/feature review and P356 Pending for entrance, boundary, and current-status review. Do not publish both as separate whole parks or silently discard P303. |

The [operator's posted regular hours](https://www.dinhteaandcoffeeop.com/)
are Monday–Thursday 09:00–21:30 and Friday–Sunday 09:00–22:00. These are
**candidate hours for one business**, not two Hours rows. They have not been
copied into either row. Park access hours, seasonal restrictions, and the
precise public entrance were not established from the inspected pages; both
park Hours rows remain unknown. Public page availability does not itself prove
permission to copy corrected fields or schedules. Record an independent reuse
basis and actual attended observation date before any proposed Hours or Places
cell update.

For any accepted candidate, review `Places!B:D` identity and category,
`E:F` exact address/postcode, `H:J` point and precision, `N:O` lifecycle and
confidence, `Q:T` evidence/date/reuse/notes, and `V` source UUID against the
original manifest. Leave `Places!A` and `Hours!A` Pending and `Hours!D:N` blank
until every Ready criterion in [Overture Review](OVERTURE_REVIEW.md) is met.
Neither pair is among the 15 preexisting seed-ID links, so no target KC3 UUID
is proposed. Recheck operation, schedule exceptions, municipal point/parcel
eligibility, and duplicate geometry at the attended review. The snapshot points
and cited pages do not certify a rooftop or public entrance.

Validation: read the exact four workbook rows and their source UUIDs from the
decisions copy; confirmed the two within-pair address/name claims and the
P23/P24 exact point equality. Reviewed the linked operator, Chamber, tourism,
and city pages through the web index on 2026-11-18. Did not edit workbook cells,
review source-license grants, or run a real staging preview because no row is
Ready. Existing fixture tests already cover compiler rejection of unsupported
Ready rows; the remaining risk here is factual identity and reuse review.
