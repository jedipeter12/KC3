# KC3-37 Ready evidence audit — 2026-11-11

Evidence audit and Product Owner dispositions. The review workbook was updated
in a new copy; no staging batch, publication, or database row was changed.
**None of the 266 former `Ready` markings is accepted as verification. Do not
stage them on that basis.**

## Scope and evidence limit

The inspected review copy is
`outputs/01a19efc-9578-7931-b036-63f2c8d31ddf/KC3_Overture_Review_verified.xlsx`
(SHA-256 `74b92b75511193c16b54b331833b2488cf5fc6bec103d7eae66130c281d3d5b3`).
`P` numbers below are its Places sheet row numbers. The original licensed
manifest is
`outputs/01a0ff66-ebbb-72c2-a2ee-8b8750222b9f/manifest.json`
(SHA-256 `6284201476b3549aff4f33643f1c8cb3f9750df4451032623aace8612bfb18c4`).
The original workbook is all Pending.

On 2026-11-11 the Product Owner directed that all records in the initial
eligibility-removal proposal be left out of the initial candidate set, and that
the two Lenexa Public Market merchants remain separate. The updated review copy
is `outputs/01a1cd62-c09b-72f2-b4cc-235c908e8f22/KC3_Overture_Review_unverified.xlsx`.
Its SHA-256 is `4b6c61a4ddaefc4dea5d729b1c16fd72027d963b13f557ebe31865262a833180`.
It changes the 266 former `Ready` rows to 249 `Pending` and 17 `Exclude`, clears
their unsupported review dates, and records the missing verification evidence
in their notes. Its 462 Places rows contain 445 `Pending`, 17 `Exclude`, and zero
`Ready`. The previous review copy is retained for traceability.

The Product Owner then accepted the named Overture source ID in each of the
four Dutch Bros and thirteen Scooter's pairs. The next review copy is
`outputs/01a1cd62-c09b-72f2-b4cc-235c908e8f22/KC3_Overture_Review_decisions.xlsx`
(SHA-256 `94df86a101473e1067ca53ddcc5e1854992abd6987be8084bf85ea4eb015fd2d`).
It records the 17 chosen IDs and 17 alternate-label holds in row notes. Both
members of each pair remain Pending; a chosen source ID is not verified or
published. The Product Owner also approved same-site KC3 matches P64→`05`,
P328→`08`, and P314→`09`; those three KC3 UUIDs are entered in the Pending
rows. P168→`11` is reserved as the proposed Downtown Olathe match but its
KC3 ID cell remains blank until attended lifecycle/identity review. The
canonical address/type choices are recorded in notes; the Overture-derived
address and type cells remain unchanged pending source permission and field
correction. The second copy retains 445 Pending, 17 Exclude, and zero Ready
Places rows, with all 462 Hours rows Pending.
The tracked [identity decision manifest](KC3_37_OVERTURE_IDENTITY_DECISIONS_2026-11-11.json)
records exact Overture UUIDs and a deterministic workbook delta: the prior and
final SHA-256 values, status/note transformation rules, owner note text, and
changed-cell counts (A 266, M 266 recalculated, P 3, R 266, T 267). Hours
values are identical. This makes the intended edit reviewable even though
review workbooks under `outputs/` are ignored by Git. Inspect the separately
retained workbook to independently verify the exported binary.

The 17 excluded Places rows are P39, P53, P58, P116, P132, P165, P167, P169,
P170, P177, P182, P243, P384, P398, P400, P414, and P416. These include
former libraries and sites, school-labeled libraries without demonstrated public
access, an apartment complex misclassified as a park, a contractor office
misclassified as coworking, a former park name, and two hospital-campus records
outside the three-city candidate set. Exclusion can be reconsidered with new
row-specific evidence; it is not a deletion of the licensed source snapshot.

In the inspected pre-decision copy, all 266 Ready notes claim import from a
user-provided 2026-11-02 verification CSV, which the Product Owner says is
unavailable. All 266 still have a generic
Overture DuckDB documentation URL for identity, an initial city/category/access
flag, `unknown` address precision, and no KC3 place ID. Their displayed dates
and `Overture license` reuse basis do not prove attended review. All 462 Hours
rows remain Pending. Optional blank websites (58 Ready rows) are not themselves
a readiness failure. The analysis below uses specific operator, library, and
municipal pages only for the cited cases; it is not a 266-row current-status,
municipal-boundary, or reuse-rights certification.

## Same-address pairs: accepted and proposed dispositions

These 24 pairs account for every same normalized city/street-address group
containing two Ready rows in the reviewed workbook. `Keep` means the preferred
identity *candidate*, not approval to mark it Ready or publish it.

| P rows | Proposal | Row-specific evidence and remaining check |
| --- | --- | --- |
| P2/P25, P82/P110, P108/P147, P109/P148 | Product Owner accepted one identity at each address: select the explicit Dutch Bros labels P25, P110, P108, P109; hold the four branch-label aliases. | [Dutch Bros Lenexa](https://www.dutchbros.com/locations/ks/lenexa) lists one store at 18181 W 101st; [Dutch Bros Olathe](https://www.dutchbros.com/locations/ks/olathe) lists one each at 14075 W 135th, 11220 S Lone Elm, and 15170 Mahaffie. Confirm workbook coordinates and current identity before Ready. |
| P3/P66, P80/P184, P83/P185, P139/P186, P215/P410, P216/P401, P218/P404, P221/P408, P222/P407, P225/P403, P226/P405, P227/P406, P272/P402 | Product Owner accepted the explicit Scooter's labels P66, P184, P185, P186, P410, P401, P404, P408, P407, P403, P405, P406, P402; hold the thirteen address/intersection labels. | Scooter's [10588 Ridgeview announcement](https://www.scooterscoffee.com/blog/post/scooters-coffee-opens-third-location-in-olathe) explicitly equates the address and intersection label for P80/P184. The same-address workbook rows support reviewing the other twelve as possible label aliases, but do not establish current operation or municipal eligibility. Those checks remain open for each store. |
| P15/P59 | Separate coffee tenant and coworking host; retain P59 as a distinct Plexpod candidate. Hold P15 Brew Gallery for current operation evidence. | [Plexpod](https://www.plexpod.com/locations/lenexa) currently lists 10000 Marshall Dr and day passes. The workbook's Brew Gallery site is not current, independent evidence for its continued operation. |
| P18/P50 | Product Owner decision: keep as two distinct candidate tenants, each still Pending. | [Lenexa Public Market's merchant map](https://www.lenexapublicmarket.com/Visit-the-Market/Market-Map) assigns Cardboard Corner Cafe and Mr. D's Coffee separate stalls; its [food page](https://www.lenexapublicmarket.com/Food-Drink) lists both. Shared street address does not merge them. |
| P103/P104 | Prefer current Comic Coffeehouse P104; hold Coffee Talk P103 as a possible predecessor. | [Comic Coffeehouse](https://www.comiccoffeehouse.com/) lists 1857 S Ridgeview Rd. No current Coffee Talk operator evidence was found. |
| P234/P392 | Hold both for source and succession review; provisionally prefer Ari Delights only if its present operation is independently documented. | [Revocup's current store list](https://revocup.com/pages/our-coffeehouses) omits 11030 Quivira. The workbook has no Ari Delights operator page. These observations suggest stale P392, but do not alone establish P234's current status. |
| P239/P328 | Product Owner accepted Oak Park branch P328, with intended canonical street suffix `St`; hold the Spanish-label duplicate P239 as Pending. | [Johnson County Library's Oak Park page](https://www.jocolibrary.org/locations/oakpark/) identifies one branch at 9500 Bluejacket **St** and a Spanish-language collection. Neither workbook row's `Dr` should silently replace the seed address. |
| P398/P450 | Product Owner decision: Exclude old-name Santa Fe Commons P398; keep current Thompson Park P450 Pending. | Overland Park's [planning record](https://opkansas.civicweb.net/document/23455/) identifies Thompson Park as the redevelopment of Santa Fe Commons at 8045 Santa Fe Dr; a later [city plan](https://opkansas.civicweb.net/document/388427/Playbook%20OP%20Joint%20Meeting%20-%20Dec%2008%202025.pdf?handle=D86D2A5986874D78A4EA6B8BB59A6CA2) calls Santa Fe Commons the former name. |
| P400/P414 | Product Owner decision: Exclude both from this three-city candidate set. They are separate businesses, not a duplicate pair. | [Merriam's comprehensive plan](https://www.merriam.org/files/sharedassets/public/v/1/comdev/comp-plan/merriam-comprehensive-plan-2040-4-14-21-reduced-size.pdf) places the 9100 W 74th hospital within Merriam. [AdventHealth](https://www.adventhealth.com/locations/hospitals/shawnee-mission/obstetrical-emergency-care) uses Merriam for that address; [Harvest Kitchen](https://shawneemmc.catertrax.com/) is a separate food-service label on the campus. Postal locality/older franchise data are not municipal-boundary proof. |

For each Dutch Bros or Scooter's pair, “prefer one ID” means selecting the
named Overture source record as the single candidate for one physical store and
holding its address/intersection-label alias. The choice is between two
**Overture IDs**; it is not a proposal to assign one KC3 ID to two source rows.
None of these franchise locations is one of the 15 preexisting local seed IDs.
If later verified and published, each physical store would receive one new KC3
UUID. The source-ID choices are accepted. Current operation, coordinates,
municipal eligibility, and reuse evidence remain open for Ready review.

## Other disputed Ready rows

| P row(s) | Proposal and evidence |
| --- | --- |
| P23 (Pending)/P24 (Ready) | Same Dinh Tea name and address, two provisional types. Keep at most one identity; defer choosing `coffee_shop` versus `boba_tea` until operator/menu evidence supports the primary use. The [Lenexa Chamber directory](https://www.lenexa.org/convention-and-visitors-bureau/restaurants/) confirms one shop at 12236 W 95th St Unit A, not two. |
| P39 | Exclude former Lackman Library as an active public library. Johnson County Library's [2024 board report](https://assets.jocolibrary.org/library-board/2024/2024_May_Board_Report.pdf) says Lenexa City Center replaced it in 2019 and its property was sold. |
| P53 | Exclude as `park` unless a distinct public park is established. The property owner's [renaming account](https://sundancebay.com/mitt-romneys-sons-part-of-value-add-apartment-play-in-kc/) identifies Oak Park Village at 9670 Halsey as an apartment complex renamed The Wilder. |
| P58/P59/P235 | P58 Performance Contracting is a construction-company office, not coworking, per its [operator page](https://www.performancecontracting.com/branch/pci-kansas-city/); propose Exclude. P59 Plexpod has [day passes](https://www.plexpod.com/locations/lenexa/); keep as a candidate. P235 Aspiria NOW has [hourly/daily desks](https://aspirianow.com/offices-and-hot-desks/) but its [current site](https://aspirianow.com/) uses 6300 Sprint Pkwy while the workbook says 6550; hold for exact entrance/address review. |
| P60 | Post Oak Park is real, but [Lenexa](https://www.lenexa.com/Parks-Places/Parks-Outdoors/Parks/Post-Oak-Park) gives 8111 Pflumm Rd, not the workbook's intersection-style address. Keep the identity candidate; correct address only with the city source and approved reuse basis. |
| P116/P167/P169 | Exclude as current public-library identities. [Olathe Public Library](https://www.olathelibrary.org/about-us/hours-locations) currently lists only Downtown at 260 E Santa Fe and Indian Creek at 16100 W 135th. Its [history](https://www.olathelibrary.org/about-us/our-story) places the former Indian Creek branch at Black Bob Rd (P167) and its 2016 temporary site at 13511 S Mur-Len (P169); P169 is not a current library parking-lot place. The [Friends page](https://www.olathelibrary.org/about-us/support-us/friends-of-the-library) describes a supporting organization/bookstore, not a branch at P116's 201 E Park St. |
| P132/P165/P170/P177/P182/P243/P384/P416 | School-labeled library candidates. Propose Exclude from the public-library category unless each school documents general public access as an independent place. The workbook itself flags school-versus-public-library review; no such access evidence is recorded. |
| P317 | Hold. The workbook labels an `ICJC Library` at 9001 W 151st. [The Islamic Center](https://www.icjc.org/) lists its campus at 9005 W 151st and describes educational programs, but does not establish a separately accessible public library at the workbook address. |
| P356/P303 (Pending) | Prefer Oak Park P356 as a candidate; hold `Green Way Park` P303 at the same address until separate identity evidence exists. [Visit Overland Park](https://www.visitoverlandpark.com/directory/oak-park/) identifies Oak Park at 11506 W 106th. |

Other flagged Ready libraries that match current public branches remain candidates,
not verified rows. No blanket inference from their taxonomy or Overture status is
made.

## Stable KC3 ID matches: accepted and proposed

The IDs below refer only to the 15 repository seed UUIDs with prefix
`6b633300-0000-4000-8000-0000000000`; suffixes identify the exact IDs.
The Product Owner accepted the P64→`05`, P328→`08`, and P314→`09` same-site
links, with the field choices below; P168→`11` remains a reserved candidate,
unmapped until attended review. The other eleven links remain proposals.
Preserve the existing UUID and KC3-owned data on an approved match. Recheck
the actual target and `updated_at` immediately before publication.

| KC3 suffix | Overture P row | Proposed decision and evidence |
| --- | ---: | --- |
| `01` Lenexa City Center Library | P36 | Match after final review; [library branch](https://www.jocolibrary.org/locations/lenexa/) confirms 8778 Penrose Lane. |
| `02` Black Dog Coffeehouse | P9 | Match at 12815 W 87th St Pkwy per [operator contact](https://bdcoffeehouse.com/contact). Its [catering page](https://bdcoffeehouse.com/catering) says 12817 for pickup; resolve that suite/entrance discrepancy before changing canonical address. |
| `03` Maps Coffee & Chocolate | P45 | Match; [operator site](https://mapscoffee.com/) confirms 13440 Santa Fe Trail Dr. |
| `04` Black Hoof Park | P10 | Match; [Lenexa park page](https://www.lenexa.com/Parks-Places/Parks-Outdoors/Parks/Black-Hoof-Park) confirms 9053 Monticello Rd. Do not map addressless P11 to the same ID. |
| `05` Sar-Ko-Par Trails Park | P64 | Product Owner accepted the park identity match and retaining 8801 Greenway Ln as the intended canonical address. [Lenexa](https://www.lenexa.com/Parks-Places/Parks-Outdoors/Parks/Sar-Ko-Par-Trails-Park) lists 8801 and separate access from 87th St Pkwy; workbook P64 still has 14915 W 87th St Pkwy. Correct the Pending row with source permission and reviewed coordinates before Ready. |
| `06` Blue Valley Library | P326 | Match generic Overture label to this branch based on [official branch and 9000 W 151st address](https://www.jocolibrary.org/locations/bluevalley/); use branch name as a sourced correction. |
| `07` Central Resource Library | P327 | Match based on the [official Johnson County branch list](https://www.jocolibrary.org/locations) and 9875 W 87th St. |
| `08` Oak Park Library | P328 | Product Owner accepted the branch match, intended `Bluejacket St` address, and hold on duplicate P239; [branch page](https://www.jocolibrary.org/locations/oakpark/). Workbook P328 still has `Dr`; source and correct before Ready. |
| `09` Homer's Coffee House | P314 | Product Owner accepted the site match and intended `coffee_shop` type over Overture `cafe` because the [operator calls itself a specialty coffee shop](https://homerscoffeehouse.com/). Source and correct the Pending row before Ready. |
| `10` Pilgrim Coffee Company | P381 | Match at 12643 Metcalf per [operator](https://pilgrimcoffeecompany.com/). |
| `11` Olathe Downtown Library | P168 (Pending) | Product Owner accepted reserving this likely match, but explicitly left the workbook ID blank until attended lifecycle and identity review. [Olathe Public Library](https://www.olathelibrary.org/about-us/hours-locations) lists the current branch at 260 E Santa Fe; its [history](https://www.olathelibrary.org/about-us/our-story) records the 2023 opening. Do not map closed P166 at 218 N Chestnut. |
| `12` Olathe Indian Creek Library | P164 | Match current 16100 W 135th branch per [official locations](https://www.olathelibrary.org/about-us/hours-locations). Former branch/temporary-site P167/P169 must not receive this ID. |
| `13` Sweet Tee's Coffee Shop | P205 | Match the main 2063 E Santa Fe site per [operator](https://www.sweetteescoffeeshop.com/). Its library café is a distinct site and should not inherit the main-store ID. |
| `14` Apogee Coffee & Draft | P86 | Match; the current [operator site](https://www.apogeecafe.com/) confirms 670 N Central and is the workbook's domain. The seed's `apogeekc.com` source is older; retain the current site as new evidence rather than treating domains as two businesses. |
| `15` Black Bob Park | P90 | Match per [Olathe's park page](https://www.olatheks.gov/government/parks-recreation/parks-trails-bike-lanes/black-bob-park). P91 `Blackbob Park Castle` is a park feature candidate, not another whole-park identity. |

## Review still open

The owner decisions on the 17 franchise source pairs, three entered KC3 links,
Downtown Olathe reservation, market merchants, and 17 initial exclusions are
recorded above. The other eleven proposed seed-ID links have not been approved
in the workbook. Separate identity, succession, and category questions remain
for P15/P59, P23/P24, P103/P104, P234/P392, and other flagged rows. Current
operation, coordinates, municipal boundary, lifecycle, source permission,
canonical field corrections, and exact target-state review must precede any
Ready marking or publication. The accepted choices do not settle those checks.

The Product Owner has already directed that the 266 markings remain unverified
and must not be staged on that basis. Any later staging requires row-specific
identity, municipality, category/access, lifecycle, duplicate, source-permission,
and observation evidence.

This review does not decide a wholesale cutover, current schedules, or final
reuse permission for facts taken from any operator or municipal page. The
existing [reconciliation contract](OVERTURE_RECONCILIATION.md)
continues to govern protected-data and target-inventory caveats.
