import { useState, useCallback, useRef, type RefObject } from 'react';

interface UseKeyboardNavOptions {
    /** Total number of line items in the list */
    itemCount: number;
    /** Ref to the main search input for re-focus */
    searchInputRef: RefObject<HTMLInputElement | null>;
    /** Ref to the save button for focus-on-empty-enter */
    saveButtonRef: RefObject<HTMLButtonElement | null>;
    /** Callback when a row's quantity edit is requested */
    onEditQuantity?: (index: number) => void;
    /** Callback when a row replacement is requested */
    onReplaceItem?: (index: number) => void;
    /** Callback when a row removal is confirmed (double-press) */
    onRemoveItem?: (index: number) => void;
    /** Callback when Enter is pressed on empty search with items */
    onEmptySearchEnter?: () => void;
}

interface UseKeyboardNavReturn {
    /** Currently focused row index in the line items list (-1 = not in list) */
    focusedIndex: number;
    /** Set focused index programmatically */
    setFocusedIndex: (index: number) => void;
    /** Index of the row showing "Press Delete again to remove" badge */
    deleteConfirmIndex: number;
    /** Index of the row currently being quantity-edited via keyboard */
    editingQtyIndex: number;
    /** Set editing qty index programmatically */
    setEditingQtyIndex: (index: number) => void;
    /** Handle keydown events from the search input when it's empty (for list navigation) */
    handleSearchKeyDown: (e: React.KeyboardEvent, isSearchEmpty: boolean, hasItems: boolean, isDropdownOpen: boolean) => void;
    /** Handle keydown events when focused on line items list */
    handleListKeyDown: (e: React.KeyboardEvent) => void;
    /** Reset nav state (call on modal reset/close) */
    resetNav: () => void;
}

export function useKeyboardNav({
    itemCount,
    searchInputRef,
    saveButtonRef,
    onEditQuantity,
    onReplaceItem,
    onRemoveItem,
    onEmptySearchEnter,
}: UseKeyboardNavOptions): UseKeyboardNavReturn {
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(-1);
    const [editingQtyIndex, setEditingQtyIndex] = useState(-1);

    // Track the delete confirm timeout so we can clear it
    const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetNav = useCallback(() => {
        setFocusedIndex(-1);
        setDeleteConfirmIndex(-1);
        setEditingQtyIndex(-1);
        if (deleteTimeoutRef.current) {
            clearTimeout(deleteTimeoutRef.current);
            deleteTimeoutRef.current = null;
        }
    }, []);

    const handleSearchKeyDown = useCallback((
        e: React.KeyboardEvent,
        isSearchEmpty: boolean,
        hasItems: boolean,
        isDropdownOpen: boolean,
    ) => {
        // Only handle navigation when search is empty and dropdown is closed
        if (!isSearchEmpty || isDropdownOpen) return;

        if (e.key === 'ArrowDown' && hasItems) {
            e.preventDefault();
            setFocusedIndex(0);
            // Blur search to allow list keydown handling
            (e.target as HTMLElement).blur();
        } else if (e.key === 'ArrowUp' && hasItems) {
            e.preventDefault();
            setFocusedIndex(itemCount - 1);
            (e.target as HTMLElement).blur();
        } else if (e.key === 'Enter' && hasItems) {
            e.preventDefault();
            // Enter on empty search with items → move to Save button
            if (onEmptySearchEnter) {
                onEmptySearchEnter();
            } else {
                saveButtonRef.current?.focus();
            }
        }
    }, [itemCount, saveButtonRef, onEmptySearchEnter]);

    const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (focusedIndex < 0) return;

        // If we're editing quantity inline, don't handle list nav keys
        if (editingQtyIndex >= 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (focusedIndex < itemCount - 1) {
                    setFocusedIndex(focusedIndex + 1);
                    setDeleteConfirmIndex(-1);
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (focusedIndex > 0) {
                    setFocusedIndex(focusedIndex - 1);
                    setDeleteConfirmIndex(-1);
                } else {
                    // ArrowUp from first item → return to search
                    setFocusedIndex(-1);
                    setDeleteConfirmIndex(-1);
                    searchInputRef.current?.focus();
                }
                break;

            case 'Escape':
                e.preventDefault();
                setFocusedIndex(-1);
                setDeleteConfirmIndex(-1);
                searchInputRef.current?.focus();
                break;

            case 'q':
            case 'Q':
                e.preventDefault();
                setEditingQtyIndex(focusedIndex);
                if (onEditQuantity) onEditQuantity(focusedIndex);
                break;

            case 'r':
            case 'R':
                e.preventDefault();
                if (onReplaceItem) onReplaceItem(focusedIndex);
                break;

            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                if (deleteConfirmIndex === focusedIndex) {
                    // Second press — confirm removal
                    if (onRemoveItem) onRemoveItem(focusedIndex);
                    setDeleteConfirmIndex(-1);
                    if (deleteTimeoutRef.current) {
                        clearTimeout(deleteTimeoutRef.current);
                        deleteTimeoutRef.current = null;
                    }
                    // Adjust focused index after removal
                    if (focusedIndex >= itemCount - 1) {
                        setFocusedIndex(Math.max(0, itemCount - 2));
                    }
                } else {
                    // First press — show confirmation badge
                    setDeleteConfirmIndex(focusedIndex);
                    // Auto-clear after 3 seconds
                    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
                    deleteTimeoutRef.current = setTimeout(() => {
                        setDeleteConfirmIndex(-1);
                        deleteTimeoutRef.current = null;
                    }, 3000);
                }
                break;
        }
    }, [focusedIndex, editingQtyIndex, itemCount, deleteConfirmIndex, searchInputRef, onEditQuantity, onReplaceItem, onRemoveItem]);

    return {
        focusedIndex,
        setFocusedIndex,
        deleteConfirmIndex,
        editingQtyIndex,
        setEditingQtyIndex,
        handleSearchKeyDown,
        handleListKeyDown,
        resetNav,
    };
}
