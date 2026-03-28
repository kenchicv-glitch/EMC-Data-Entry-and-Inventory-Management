# Sales Window Refinements Decisions

**Date:** 2026-03-24

### Scope
- **Invoice Logic**: OS invoices are separate from Type A and B. OS counter resets to 1 daily. A/B buttons will be disabled when OS is active. **The invoice number must remain fully editable at all times.**
- **Fulfillment**: Remove fulfillment status selection from the Sales Window. Default all to "Store Pickup" for now.
- **Customer UX**: Selection list shows on hover and stays open while the mouse remains within the input or list area.
- **UI Adjustments**: VAT text centered and red when active. "DSC" renamed to "Discount".
- **Summary Format**: Match the reference image's layout for financial summaries in the dashboard.

### Approach
- **Counter Reset**: Fetch latest `invoice_number` for OS by filtering for the current date.
- **VAT Calculation**: Verify if "Add: VAT" at the end is a standard 12% re-addition to the net discounted total.
- **CSS**: Apply specific styling for centered VAT dropdowns and hover-active states.

### Constraints
- Ensure BIR compliance for standard invoices (A/B) while keeping OS simple.
- Maintain stock sync logic regardless of invoice type.
