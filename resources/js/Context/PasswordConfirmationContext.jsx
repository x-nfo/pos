import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { router } from "@inertiajs/react";
import PasswordConfirmModal from "@/Components/Modals/PasswordConfirmModal";

const PasswordConfirmationContext = createContext(null);

export function PasswordConfirmationProvider({ children, initialFreshUntil = null }) {
    const [stepUpFreshUntil, setStepUpFreshUntil] = useState(initialFreshUntil);
    const [modalState, setModalState] = useState({
        isOpen: false,
        title: "Konfirmasi Password",
        description: "Masukkan password akun Anda untuk mengonfirmasi dan melanjutkan tindakan ini.",
        challenge: null,
    });

    const pendingCallbackRef = useRef(null);

    // Synchronize when server updates props on Inertia navigation or mutation
    useEffect(() => {
        const unsubscribeNavigate = router.on("navigate", (event) => {
            const serverFreshUntil = event.detail.page?.props?.security?.stepUpFreshUntil;
            if (serverFreshUntil !== undefined) {
                setStepUpFreshUntil(serverFreshUntil);
            }
        });

        const unsubscribeSuccess = router.on("success", (event) => {
            const serverFreshUntil = event.detail.page?.props?.security?.stepUpFreshUntil;
            if (serverFreshUntil !== undefined) {
                setStepUpFreshUntil(serverFreshUntil);
            }
        });

        const unsubscribeInvalid = router.on("invalid", (event) => {
            const status = event.detail.response?.status;
            const data = event.detail.response?.data;
            if (status === 423 || data?.password_confirmation_required) {
                event.preventDefault();
                setModalState({
                    isOpen: true,
                    title: "Konfirmasi Password",
                    description: "Sesi konfirmasi password Anda telah kedaluwarsa. Masukkan password akun Anda untuk melanjutkan.",
                    challenge: data?.challenge?.route ? data.challenge.route.replaceAll(".", " / ") : null,
                });
            }
        });

        return () => {
            if (typeof unsubscribeNavigate === "function") unsubscribeNavigate();
            if (typeof unsubscribeSuccess === "function") unsubscribeSuccess();
            if (typeof unsubscribeInvalid === "function") unsubscribeInvalid();
        };
    }, []);

    const isStepUpActive = useCallback(() => {
        if (!stepUpFreshUntil) return false;
        const expiry = new Date(stepUpFreshUntil).getTime();
        return !isNaN(expiry) && expiry > Date.now();
    }, [stepUpFreshUntil]);

    const requirePasswordConfirmation = useCallback(
        ({
            onConfirmed,
            title = "Konfirmasi Password",
            description = "Masukkan password akun Anda untuk mengonfirmasi dan melanjutkan tindakan ini.",
            challenge = null,
        } = {}) => {
            if (isStepUpActive()) {
                if (typeof onConfirmed === "function") {
                    onConfirmed();
                }
                return;
            }

            pendingCallbackRef.current = onConfirmed;
            setModalState({
                isOpen: true,
                title,
                description,
                challenge,
            });
        },
        [isStepUpActive]
    );

    const handleModalSuccess = (newFreshUntil) => {
        if (newFreshUntil) {
            setStepUpFreshUntil(newFreshUntil);
        }
        setModalState((prev) => ({ ...prev, isOpen: false }));

        const callback = pendingCallbackRef.current;
        pendingCallbackRef.current = null;

        if (typeof callback === "function") {
            // Execute after state update has settled
            setTimeout(() => {
                callback();
            }, 50);
        }
    };

    const handleModalCancel = () => {
        setModalState((prev) => ({ ...prev, isOpen: false }));
        pendingCallbackRef.current = null;
    };

    return (
        <PasswordConfirmationContext.Provider
            value={{
                stepUpFreshUntil,
                isStepUpActive,
                requirePasswordConfirmation,
            }}
        >
            {children}

            <PasswordConfirmModal
                isOpen={modalState.isOpen}
                title={modalState.title}
                description={modalState.description}
                challenge={modalState.challenge}
                onSuccess={handleModalSuccess}
                onCancel={handleModalCancel}
            />
        </PasswordConfirmationContext.Provider>
    );
}

export function usePasswordConfirmation() {
    const context = useContext(PasswordConfirmationContext);
    if (!context) {
        throw new Error(
            "usePasswordConfirmation must be used within a PasswordConfirmationProvider"
        );
    }
    return context;
}
