import React from "react";
import SalesReturnForm from "./Form";
import { useAuthorization } from "@/Utils/authorization";

export default function Create({ transaction, availableProducts = [] }) {
    const { can } = useAuthorization();

    return (
        <SalesReturnForm
            title="Buat Retur Penjualan"
            transaction={transaction}
            availableProducts={availableProducts}
            submitRoute={route("sales-returns.store", transaction.id)}
            submitMethod="post"
            canEdit
            canComplete={can("sales-returns-complete")}
        />
    );
}

Create.layout = SalesReturnForm.layout;
