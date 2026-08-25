import { buildEscPosReceipt, buildEscPosSalesReturnReceipt } from "./webUsbPrinter";

/**
 * Common Bluetooth Thermal Printer Service & SPP UUIDs
 */
const PRINTER_BLUETOOTH_SERVICES = [
    "000018f0-0000-1000-8000-00805f9b34fb", // Generic Thermal Printer Service
    "00001101-0000-1000-8000-00805f9b34fb", // Serial Port Profile (SPP)
    "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC / Microchip Serial
    "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // POS Thermal Printer Service
    "0000af00-0000-1000-8000-00805f9b34fb", // Xprinter / Goojprt
];

/**
 * Check if Web Bluetooth API is supported in current browser
 */
export function isWebBluetoothSupported() {
    return typeof window !== "undefined" && Boolean(navigator?.bluetooth);
}

/**
 * Print transaction receipt directly via Web Bluetooth API (ESC/POS)
 * 
 * @param {Object} transaction Transaction object with details, invoice, etc.
 * @param {Object} storeInfo Store profile (name, address, phone)
 * @param {String} paperSize "58mm" | "80mm"
 * @returns {Promise<boolean>}
 */
export async function printViaBluetooth(transaction, storeInfo = {}, paperSize = "58mm") {
    if (!isWebBluetoothSupported()) {
        throw new Error(
            "Web Bluetooth API tidak didukung di browser ini. Gunakan Google Chrome (Android/Desktop), Microsoft Edge, atau Samsung Internet."
        );
    }

    // 1. Prompt user to select Bluetooth Printer
    const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_BLUETOOTH_SERVICES,
    });

    if (!device) {
        throw new Error("Tidak ada perangkat Bluetooth yang dipilih.");
    }

    if (!device.gatt) {
        throw new Error("Perangkat Bluetooth tidak memiliki layanan GATT.");
    }

    // 2. Connect to GATT Server
    const server = await device.gatt.connect();

    try {
        let targetService = null;
        let targetCharacteristic = null;

        // 3. Search for available GATT services
        const services = await server.getPrimaryServices();

        for (const service of services) {
            try {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    // Look for writable characteristic
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        targetService = service;
                        targetCharacteristic = char;
                        break;
                    }
                }
            } catch (e) {
                // Ignore service read errors on unsupported GATT attributes
            }
            if (targetCharacteristic) break;
        }

        if (!targetCharacteristic) {
            throw new Error(
                `Printer Bluetooth "${device.name || "Perangkat"}" terhubung, tetapi tidak memiliki karakteristik cetak (Write Characteristic).`
            );
        }

        // 4. Build ESC/POS binary payload
        const data = buildEscPosReceipt(transaction, storeInfo, paperSize);

        // 5. Send payload in chunks to avoid Bluetooth MTU buffer overflow
        const chunkSize = 100; // 100 bytes safe chunk
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            if (targetCharacteristic.properties.writeWithoutResponse) {
                await targetCharacteristic.writeValueWithoutResponse(chunk);
            } else {
                await targetCharacteristic.writeValue(chunk);
            }
            // 20ms delay between chunks for mini thermal printer hardware buffer
            await new Promise((resolve) => setTimeout(resolve, 20));
        }

        return true;
    } finally {
        // Disconnect after transmission with slight buffer delay
        setTimeout(() => {
            if (device.gatt?.connected) {
                device.gatt.disconnect();
            }
        }, 500);
    }
}

/**
 * Print sales return receipt directly via Web Bluetooth API (ESC/POS)
 * 
 * @param {Object} salesReturn SalesReturn object with items, exchange_items, code, etc.
 * @param {Object} storeInfo Store profile (name, address, phone)
 * @param {String} paperSize "58mm" | "80mm"
 * @returns {Promise<boolean>}
 */
export async function printSalesReturnViaBluetooth(salesReturn, storeInfo = {}, paperSize = "58mm") {
    if (!isWebBluetoothSupported()) {
        throw new Error(
            "Web Bluetooth API tidak didukung di browser ini. Gunakan Google Chrome (Android/Desktop), Microsoft Edge, atau Samsung Internet."
        );
    }

    const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_BLUETOOTH_SERVICES,
    });

    if (!device) {
        throw new Error("Tidak ada perangkat Bluetooth yang dipilih.");
    }

    if (!device.gatt) {
        throw new Error("Perangkat Bluetooth tidak memiliki layanan GATT.");
    }

    const server = await device.gatt.connect();

    try {
        let targetService = null;
        let targetCharacteristic = null;

        const services = await server.getPrimaryServices();

        for (const service of services) {
            try {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        targetService = service;
                        targetCharacteristic = char;
                        break;
                    }
                }
            } catch (e) {
                // Ignore
            }
            if (targetCharacteristic) break;
        }

        if (!targetCharacteristic) {
            throw new Error(
                `Printer Bluetooth "${device.name || "Perangkat"}" terhubung, tetapi tidak memiliki karakteristik cetak (Write Characteristic).`
            );
        }

        const data = buildEscPosSalesReturnReceipt(salesReturn, storeInfo, paperSize);

        const chunkSize = 100;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            if (targetCharacteristic.properties.writeWithoutResponse) {
                await targetCharacteristic.writeValueWithoutResponse(chunk);
            } else {
                await targetCharacteristic.writeValue(chunk);
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }

        return true;
    } finally {
        setTimeout(() => {
            if (device.gatt?.connected) {
                device.gatt.disconnect();
            }
        }, 500);
    }
}

