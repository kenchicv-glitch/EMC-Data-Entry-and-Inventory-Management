# STATE.md

**Current Phase**: Phase 15 (Modal UX & Scroll Locking)
**Last Action**: Standardized scroll locking and centered placement across all system-wide modals, including Fixing `TransferRequestModal`, `NotificationModal`, `CustomerModal`, and `SupplierModal`.

## Recent Changes
- Phase 14: Added 'Edit' button for pending requests and 'Undo' button for cancelled transfers (owner-only).
- Phase 15: Implemented global scroll locking using `modal-open` class in `index.css`.
- Updated all major modals to use `createPortal` for top-level DOM rendering.
- Verified centered placement (`flex items-center justify-center`) for modal windows.
