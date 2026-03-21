import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface ModalState {
    isOpen: boolean;
    editData: any | null;
}

interface ModalContextType {
    salesModal: ModalState;
    purchaseModal: ModalState;
    openSalesModal: (data?: any) => void;
    closeSalesModal: () => void;
    openPurchaseModal: (data?: any) => void;
    closePurchaseModal: () => void;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [salesModal, setSalesModal] = useState<ModalState>({ isOpen: false, editData: null });
    const [purchaseModal, setPurchaseModal] = useState<ModalState>({ isOpen: false, editData: null });

    const openSalesModal = useCallback((data: any = null) => {
        setSalesModal({ isOpen: true, editData: data });
    }, []);

    const closeSalesModal = useCallback(() => {
        setSalesModal({ isOpen: false, editData: null });
    }, []);

    const openPurchaseModal = useCallback((data: any = null) => {
        setPurchaseModal({ isOpen: true, editData: data });
    }, []);

    const closePurchaseModal = useCallback(() => {
        setPurchaseModal({ isOpen: false, editData: null });
    }, []);

    return (
        <ModalContext.Provider 
            value={{ 
                salesModal, 
                purchaseModal, 
                openSalesModal, 
                closeSalesModal, 
                openPurchaseModal, 
                closePurchaseModal 
            }}
        >
            {children}
        </ModalContext.Provider>
    );
};

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
};
