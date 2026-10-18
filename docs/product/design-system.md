# Rashaqa mobile — observed design system

**Scope:** [Rashaqa — Mobile Web (390)](https://www.figma.com/design/dZPtsNiHOfyhqRgHb6H0yx/clinc?node-id=65-147), particularly the [V0 & V1 section](https://www.figma.com/design/dZPtsNiHOfyhqRgHb6H0yx/clinc?node-id=181-5616). These are **observations from resolved Figma nodes**, not an invented implementation token file or a claim that every value is a published Figma variable. Later V2/V3 screens on this canvas also use the Noto Sans Arabic, teal, violet and slate visual language.

## Variables versus observed styles

The MCP response contains `globalVars.styles` entries for referenced fills, text styles, layouts, strokes and effects. It did not provide a verified named **Figma variable collection**, variable IDs, aliases, modes or bindings for this canvas. Consequently the colors and dimensions below are **observed values**. Do not infer that the generated `fill_…`/`layout_…` identifiers are stable token names. A separately defined light/dark mode or a formal spacing/radius scale is unverified.

## Colors (verified examples)

| Use visible in scoped frames      | Resolved value         | Evidence                                                    |
| --------------------------------- | ---------------------- | ----------------------------------------------------------- |
| White screen/card/input           | `#FFFFFF`              | `D8` background and input; `fill_QCXABT`                    |
| Dark primary text / toast surface | `#0F172A`              | `D8` titles and success toast; `fill_6UUM9T`                |
| Muted text                        | `#64748B`              | `D8` subtitles and descriptions; `fill_5GA8YR`              |
| Soft slate surface                | `#F1F5F9`              | `E1` notification-bell surface; `fill_E51XNM`               |
| Deep teal text / primary button   | `#0F766E`              | `D8` primary action and section accents; `fill_W15645`      |
| Darker teal accent                | `#115E59`              | Active doctor navigation icon/text treatment; `fill_1RQN3Y` |
| Pale teal surface                 | `#F0FDFA`              | `D8` weight card and soft action; `fill_1MVKD0`             |
| Pale teal border                  | `#99F6E4`              | Weight card stroke in `D8`                                  |
| Focus outline                     | `#14B8A6`              | Focused phone field and notes textarea (`stroke_NRLHEG`)    |
| Neutral hairline                  | `#E2E8F0`              | Field/card separators (`stroke_YIWX62`)                     |
| Good weight-delta surface/text    | `#F0FDF4` / `#15803D`  | `D8` down-good badge (`122:354`); border `#BBF7D0`          |
| Destructive pale surface / text   | `#FEF2F2` / `#B91C1C`  | `E4` dialog treatment; `fill_1MZ5PA` / `fill_WHND87`        |
| Destructive dialog scrim          | `rgba(5, 8, 20, 0.55)` | `E4` overlay (`122:1198`)                                   |

The page includes additional status/accent colors. The table deliberately does not name an exhaustive palette or claim semantic assignments for colors whose role was not confirmed on the scoped screens. The `WeightDelta` component description explicitly says **toward the patient's goal = green; away from goal = red**, so a downward change is not intrinsically good for every patient (component set `117:309`).

## Typography

Resolved scoped text styles use **Noto Sans Arabic**. Verified examples from the nested section:

| Named style                                               | Size / weight        | Line-height | Example                                |
| --------------------------------------------------------- | -------------------- | ----------- | -------------------------------------- |
| `text/xs/regular`, `text/xs/semibold`                     | 12px / 400, 600      | 16px        | subtitles, weight badge                |
| `text/sm/regular`, `text/sm/medium`, `text/sm/bold`       | 14px / 400, 500, 700 | 20px        | help text, field labels, small actions |
| `text/base/regular`, `text/base/medium`, `text/base/bold` | 16px / 400, 500, 700 | 24px        | textareas, meal text, buttons          |
| `text/lg/medium`                                          | 18px / 500           | 28px        | visit section headers                  |
| `text/xl/medium`                                          | 20px / 500           | 28px        | visit top bar                          |
| `text/2xl/semibold`                                       | 24px / 600           | 32px        | empty-state title / dialog title       |
| `text/3xl/bold`                                           | 30px / 700           | 38px        | current weight or login heading        |

Other weights/sizes appear elsewhere on the same canvas (including V2/V3); these rows describe verified examples rather than a complete typography contract. Although Arabic text and right-anchored stacks demonstrate an RTL presentation, exported text-style metadata sometimes reports `textAlignHorizontal: LEFT`. Do not treat that metadata alone as a tested browser `dir` policy; bidirectional numbers, dates and filenames still need specification.

## Layout, spacing, radius and shadows

- The nested `D8` frame is **390 × 844px**, with a 390px-wide top bar (`8px 12px` padding) and content stack (`16px` padding and `16px` gap). Its weight card has `16px` padding, `8px` gap and `16px` corner radius. A section stack there uses `12px` gap. Other observed gaps include `4px` and `8px`; the attachment actions have `12px` gap. These are **observed uses**, not a verified global spacing scale.
- Scoped examples use radii **8px** (meal row), **12px** (field, button, file row, toast), **16px** (weight/day card and dialog), **24px** (390px design-frame corner), and **9999px** (pill/icon circle). Frame corner rounding is presentation chrome, not necessarily an app viewport requirement.
- Exact resolved shadow examples: confirmation dialog `0px 12px 32px 0px rgba(0,0,0,0.2)` (`E4`), one overlay/toast style `0px 6px 16px 0px rgba(0,0,0,0.2)`, and success toast `0px 8px 24px 0px rgba(0,0,0,0.25)` (`A9`). No global shadow scale was verified.
- Layouts are predominantly Figma auto-layout columns and rows with stretch/fill sizing and right-anchored Arabic stacks. `D8` uses a header/content/bottom action-bar arrangement; `S1` uses header/content/bottom navigation. `D4` puts tabs above record content. **390px** is the only breakpoint in scope; no mobile-to-tablet/desktop transformation or grid-column rule can be derived from this page. No density or safe-area behavior has been confirmed beyond the mockup's drawn iPhone status bar.

## Design assets

The scoped section uses SVG icon instances (`Icon / phone`, `lock`, `search`, `check`, `upload`, `camera`, `file`, `calendar`, `bell`, `scale`, `trash`, navigation chevrons, and others), including `Rashaqa / IconButton` size variants 16/18/20. Login frames also include placed image-filled rectangles with distinct `ChatGPT Image Sep 26, 2026…` names (`118:3` and `181:3622`). This confirms image assets are placed, but **not** which artwork is approved or a canonical asset filename. No assets have been downloaded or added to the repository in this analysis.
