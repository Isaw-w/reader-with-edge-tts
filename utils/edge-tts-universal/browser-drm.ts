import { TRUSTED_CLIENT_TOKEN } from './constants';
import { SkewAdjustmentError } from "./exceptions";
import { sha256 } from 'js-sha256';

const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;

/**
 * Browser-specific DRM class that uses only Web APIs.
 * Uses the Web Crypto API instead of Node.js crypto module.
 */
export class BrowserDRM {
    private static clockSkewSeconds = 0.0;

    static adjClockSkewSeconds(skewSeconds: number) {
        BrowserDRM.clockSkewSeconds += skewSeconds;
    }

    static getUnixTimestamp(): number {
        return Date.now() / 1000 + BrowserDRM.clockSkewSeconds;
    }

    static parseRfc2616Date(date: string): number | null {
        try {
            return new Date(date).getTime() / 1000;
        } catch (e) {
            return null;
        }
    }

    static handleClientResponseError(response: { status: number; headers: Record<string, string> }) {
        if (!response.headers) {
            throw new SkewAdjustmentError("No headers in response.");
        }
        const serverDate = response.headers["date"] || response.headers["Date"];
        if (!serverDate) {
            throw new SkewAdjustmentError("No server date in headers.");
        }
        const serverDateParsed = BrowserDRM.parseRfc2616Date(serverDate);
        if (serverDateParsed === null) {
            throw new SkewAdjustmentError(`Failed to parse server date: ${serverDate}`);
        }
        const clientDate = BrowserDRM.getUnixTimestamp();
        BrowserDRM.adjClockSkewSeconds(serverDateParsed - clientDate);
    }

    static async generateSecMsGec(): Promise<string> {
        let ticks = BrowserDRM.getUnixTimestamp();
        ticks += WIN_EPOCH;
        ticks -= ticks % 300;
        ticks *= S_TO_NS / 100;

        const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;

        // Use Web Crypto API if available (Secure Context), otherwise fallback to js-sha256
        if (crypto && crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(strToHash);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        } else {
            // Fallback for non-secure contexts (e.g. HTTP on local network)
            console.warn("crypto.subtle not available, using js-sha256 fallback");
            return sha256(strToHash).toUpperCase();
        }
    }
}
