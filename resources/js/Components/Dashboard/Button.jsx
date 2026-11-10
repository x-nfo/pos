import { Link } from "@inertiajs/react";
import React from "react";
import { useForm } from "@inertiajs/react";
import Swal from "sweetalert2";

export default function Button({
    className,
    icon,
    label,
    type,
    href,
    added,
    url,
    id,
    ...props
}) {
    const { delete: destroy } = useForm();

    const deleteData = async (url) => {
        Swal.fire({
            title: "Hapus Data?",
            text: "Data master yang memiliki relasi historis akan dilindungi dari penghapusan.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#6366f1",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus!",
            cancelButtonText: "Batal",
        }).then((result) => {
            if (result.isConfirmed) {
                destroy(url);
            }
        });
    };

    const baseStyles =
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 active:scale-[0.98]";
    const sizeStyles = "px-4 py-2.5 text-sm rounded-xl";
    const smallStyles = "px-3 py-2 rounded-xl";

    const iconElement = React.useMemo(() => {
        if (!icon) return null;
        if (React.isValidElement(icon)) return icon;
        if (typeof icon === "function" || (typeof icon === "object" && icon?.$$typeof)) {
            const IconComponent = icon;
            return <IconComponent size={18} />;
        }
        return icon;
    }, [icon]);

    return (
        <>
            {type === "link" &&
                (href ? (
                    <Link
                        href={href}
                        className={`${baseStyles} ${sizeStyles} ${className}`}
                        {...props}
                    >
                        {iconElement}{" "}
                        <span
                            className={`${added === true ? "hidden lg:block" : ""}`}
                        >
                            {label}
                        </span>
                    </Link>
                ) : (
                    <button
                        type="button"
                        className={`${baseStyles} ${sizeStyles} ${className}`}
                        {...props}
                    >
                        {iconElement}{" "}
                        <span
                            className={`${added === true ? "hidden lg:block" : ""}`}
                        >
                            {label}
                        </span>
                    </button>
                ))}
            {type === "button" && (
                <button
                    className={`${baseStyles} ${sizeStyles} ${className}`}
                    {...props}
                >
                    {iconElement}{" "}
                    <span
                        className={`${added === true ? "hidden md:block" : ""}`}
                    >
                        {label}
                    </span>
                </button>
            )}
            {type === "submit" && (
                <button
                    type="submit"
                    className={`${baseStyles} ${sizeStyles} ${className}`}
                    {...props}
                >
                    {iconElement}{" "}
                    <span
                        className={`${added === true ? "hidden lg:block" : ""}`}
                    >
                        {label}
                    </span>
                </button>
            )}
            {type === "delete" && (
                <button
                    onClick={() => deleteData(url)}
                    className={`${baseStyles} ${smallStyles} ${className}`}
                    {...props}
                >
                    {iconElement} {label && <span>{label}</span>}
                </button>
            )}
            {type === "modal" && (
                <button
                    className={`${baseStyles} ${smallStyles} ${className}`}
                    {...props}
                >
                    {iconElement}
                </button>
            )}
            {type === "edit" && (
                <Link
                    href={href}
                    className={`${baseStyles} ${smallStyles} ${className}`}
                    {...props}
                >
                    {iconElement}
                </Link>
            )}
            {type === "bulk" && (
                <button
                    {...props}
                    className={`${baseStyles} ${sizeStyles} ${className}`}
                >
                    {iconElement}{" "}
                    <span
                        className={`${added === true ? "hidden lg:block" : ""}`}
                    >
                        {label}
                    </span>
                </button>
            )}
        </>
    );
}
