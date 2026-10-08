var extHelper_LastParentVariant = null;
const extHelper_processedRecommendationResponses = new WeakSet();
const extHelper_pageWindow = typeof unsafeWindow !== 'undefined' && unsafeWindow ? unsafeWindow : window;
const extHelper_fetchHookKey = '__aveInfiniteSpinnerFixFetchHooked';

function extHelper_getRequestUrl(input) {
    try {
        const urlValue = typeof input === 'string' ? input :
            (input && typeof input.url === 'string' ? input.url :
                (input && typeof input.href === 'string' ? input.href : String(input)));
        return new URL(urlValue, extHelper_pageWindow.location.href);
    } catch {
        return null;
    }
}

function extHelper_isVineApiRequest(input, endpoint) {
    const requestUrl = extHelper_getRequestUrl(input);
    if (!requestUrl || requestUrl.origin !== extHelper_pageWindow.location.origin) return false;
    return new RegExp(`/api/${endpoint}(?:/|$)`).test(requestUrl.pathname);
}

function extHelper_isSpinnerFixEnabled() {
    try {
        if (typeof GM_getValue === 'function') {
            const storedSettings = GM_getValue('AVE_SETTINGS', {});
            if (storedSettings && typeof storedSettings.EnableInfiniteSpinnerFix === 'boolean') {
                return storedSettings.EnableInfiniteSpinnerFix;
            }
        }
    } catch {
        // Use the loaded AVE setting when synchronous userscript storage is unavailable.
    }
    return typeof SETTINGS === 'undefined' || SETTINGS.EnableInfiniteSpinnerFix !== false;
}

function extHelper_formatDimensionValue(value) {
    if (typeof value !== 'string') return value;

    let formatted = value;
    if (!/[a-z0-9]$/i.test(formatted)) formatted += 'fixed';
    formatted = formatted.replace(/([:)])([^\s])/g, '$1 $2');
    formatted = formatted.replace(/(\s[/])/g, '/');
    return formatted;
}

function extHelper_repairRecommendationData(responseData) {
    const variations = responseData && responseData.result && responseData.result.variations;
    if (!Array.isArray(variations)) return 0;

    const dimensionEntries = variations.map((variation) => {
        const dimensions = variation && variation.dimensions;
        return dimensions && typeof dimensions === 'object' && !Array.isArray(dimensions) ? Object.entries(dimensions) : [];
    });
    const templateEntries = dimensionEntries.reduce((best, current) => current.length > best.length ? current : best, []);
    const templateKeys = templateEntries.map(([key]) => key);
    const hasIncompleteDimensions = dimensionEntries.some((entries) => entries.length < templateKeys.length);
    const combineDimensions = hasIncompleteDimensions && templateKeys.length > 1;
    let fixed = 0;

    if (combineDimensions) {
        variations.forEach((variation, index) => {
            if (!variation || typeof variation !== 'object') return;
            const entries = dimensionEntries[index];
            if (entries.length === 0) {
                variation.dimensions = { variation: variation && variation.asin ? variation.asin : 'N/A' };
            } else {
                const valuesByKey = new Map(entries.filter(([key]) => templateKeys.includes(key)));
                const unmatchedEntries = entries.filter(([key]) => !templateKeys.includes(key));
                const availableKeys = templateKeys.filter((key) => !valuesByKey.has(key));
                unmatchedEntries.forEach(([key, value], entryIndex) => {
                    const targetKey = availableKeys[entryIndex];
                    if (targetKey) valuesByKey.set(targetKey, value);
                });
                const values = templateKeys.map((key) => extHelper_formatDimensionValue(valuesByKey.get(key) ?? 'N/A'));
                variation.dimensions = { variation: values.join(', ') };
            }
            fixed++;
        });
        return fixed;
    }

    variations.forEach((variation, index) => {
        if (!variation || typeof variation !== 'object') return;
        const entries = dimensionEntries[index];
        if (entries.length === 0) {
            variation.dimensions = { asin_no: variation && variation.asin ? variation.asin : '' };
            fixed++;
            return;
        }

        const normalizedDimensions = {};
        const knownEntries = entries.filter(([key]) => templateKeys.includes(key));
        const unmatchedEntries = entries.filter(([key]) => !templateKeys.includes(key));
        knownEntries.forEach(([key, value]) => {
            const formattedValue = extHelper_formatDimensionValue(value);
            normalizedDimensions[key] = formattedValue;
            if (formattedValue !== value) fixed++;
        });
        const availableKeys = templateKeys.filter((key) => !Object.prototype.hasOwnProperty.call(normalizedDimensions, key));
        unmatchedEntries.forEach(([key, value], entryIndex) => {
            const normalizedKey = availableKeys[entryIndex] || key;
            const formattedValue = extHelper_formatDimensionValue(value);
            normalizedDimensions[normalizedKey] = formattedValue;
            if (normalizedKey !== key || formattedValue !== value) fixed++;
        });

        if (Object.keys(normalizedDimensions).some((key, keyIndex) => key !== entries[keyIndex][0])) {
            variation.dimensions = normalizedDimensions;
        } else if (entries.some(([key, value]) => normalizedDimensions[key] !== value)) {
            variation.dimensions = normalizedDimensions;
        }
    });

    return fixed;
}

async function extHelper_repairRecommendationResponse(response) {
    if (extHelper_processedRecommendationResponses.has(response) || !extHelper_isSpinnerFixEnabled()) return response;
    extHelper_processedRecommendationResponses.add(response);

    if (response.type === 'opaque' || !response.ok || response.status !== 200) return response;

    try {
        const responseData = await response.clone().json();
        const fixed = extHelper_repairRecommendationData(responseData);
        if (fixed === 0) return response;

        const headers = new extHelper_pageWindow.Headers(response.headers);
        ['content-length', 'content-encoding', 'content-md5', 'content-range', 'transfer-encoding'].forEach((name) => headers.delete(name));
        const repairedResponse = new extHelper_pageWindow.Response(JSON.stringify(responseData), {
            headers,
            status: response.status,
            statusText: response.statusText,
        });
        extHelper_processedRecommendationResponses.add(repairedResponse);
        extHelper_pageWindow.postMessage({ type: 'infiniteWheelFixed', text: `${fixed} variation(s) fixed.` }, '*');
        return repairedResponse;
    } catch {
        return response;
    }
}

function extHelper_installRecommendationFetchHook() {
    if (extHelper_pageWindow[extHelper_fetchHookKey] || typeof extHelper_pageWindow.fetch !== 'function') return;

    const originalFetch = extHelper_pageWindow.fetch;
    const hookedFetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        if (!extHelper_isVineApiRequest(args[0], 'recommendations') || !extHelper_isSpinnerFixEnabled()) return response;
        return extHelper_repairRecommendationResponse(response);
    };

    try {
        extHelper_pageWindow.fetch = hookedFetch;
        extHelper_pageWindow[extHelper_fetchHookKey] = true;
    } catch (error) {
        console.warn('[AVE] Could not install the recommendation response hook.', error);
    }
}

extHelper_installRecommendationFetchHook();

async function vineFetch(...args) {
    let response = await extHelper_pageWindow.fetch.apply(extHelper_pageWindow, args);
    const lastParent = extHelper_LastParentVariant;
    const request = args[0];

    if (extHelper_isVineApiRequest(request, 'voiceOrders')) {
        let postData = {};
        let responseData = {};
        try {
            const body = args[1] && args[1].body ? args[1].body : null;
            postData = body ? JSON.parse(body) : {};
        } catch (error) {
            console.error('[CF] | Failed to parse post body', error);
        }
        try {
            responseData = await response.clone().json();
        } catch (error) {
            console.error('[CF] | Failed to read response JSON (voiceOrders)', error);
        }

        let parentAsin = null;
        if (lastParent && lastParent.recommendationId) {
            const match = lastParent.recommendationId.match(/^.+?#(.+?)#.+$/);
            if (match) parentAsin = match[1];
        }

        let data = { status: 'success', error: null, parent_asin: parentAsin, asin: postData.itemAsin || null };
        if (responseData && responseData.error != null) {
            data = { status: 'failed', error: responseData.error, parent_asin: parentAsin, asin: postData.itemAsin || null };
        }
        window.postMessage({ type: 'order', data }, '*');
        await new Promise((resolve) => setTimeout(resolve, 500));
        return response;
    }

    if (extHelper_isVineApiRequest(request, 'recommendations')) {
        response = await extHelper_repairRecommendationResponse(response);
        let responseData = {};
        try {
            responseData = await response.clone().json();
        } catch (error) {
            console.error('[CF] | Failed to read response JSON (recommendations)', error);
        }

        const result = responseData && responseData.result ? responseData.result : null;
        const error = responseData && responseData.error ? responseData.error : null;
        if (!result) {
            if (error && error.exceptionType) {
                window.postMessage({ type: 'error', data: { error: error.exceptionType } }, '*');
            }
            return response;
        }

        if (result.variations !== undefined) {
            extHelper_LastParentVariant = result;
        } else if (result.taxValue !== undefined) {
            const isChild = !!lastParent && !!lastParent.variations && lastParent.variations.some((variation) => variation.asin == result.asin);
            const data = { parent_asin: null, asin: result.asin, etv: result.taxValue };
            if (isChild && lastParent && lastParent.recommendationId) {
                const match = lastParent.recommendationId.match(/^.+?#(.+?)#.+$/);
                if (match) data.parent_asin = match[1];
            } else {
                extHelper_LastParentVariant = null;
            }
            window.postMessage({ type: 'etv', data }, '*');
        }
    }

    return response;
}
