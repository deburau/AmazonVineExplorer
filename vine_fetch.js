function initInjectScript() {
    if (document.getElementById('fetchfix')) {
        console.warn('[CF] | Custom Fetch already injected');
        return;
    }
    var scriptTag = document.createElement("script");
    scriptTag.id = 'fetchfix';
    // Inject the infinite loading wheel fix into the page context
    scriptTag.innerHTML = newFetch;
    scriptTag.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(scriptTag);
    console.log('[CF] | Custom Fetch injected');
}


const newFetch = `
(function(){
const origFetch = window.fetch;
var extHelper_LastParentVariant = null;
var extHelper_responseData = {};
var extHelper_postData = {};

window.fetch = async (...args) => {
    let response = await origFetch(...args);
    let lastParent = extHelper_LastParentVariant;

    const url = args[0] || "";

    // Handle orders
    if (url.startsWith("api/voiceOrders")) {
        // parse post body safely
        try {
            const body = args[1] && args[1].body ? args[1].body : null;
            extHelper_postData = body ? JSON.parse(body) : {};
        } catch (e) {
            console.error('[CF] | Failed to parse post body', e);
            extHelper_postData = {};
        }
        const asin = extHelper_postData.itemAsin || null;

        try {
            extHelper_responseData = await response.clone().json();
        } catch (e) {
            console.error('[CF] | Failed to read response JSON (voiceOrders)', e);
            extHelper_responseData = {};
        }

        let parentAsin = null;
        if (lastParent && lastParent.recommendationId) {
            const m = lastParent.recommendationId.match(/^.+?#(.+?)#.+$/);
            if (m) parentAsin = m[1];
        }

        let data = {
            status: "success",
            error: null,
            parent_asin: parentAsin,
            asin: asin,
        };

        if (extHelper_responseData && extHelper_responseData.error != null) {
            data = {
                status: "failed",
                error: extHelper_responseData.error,
                parent_asin: parentAsin,
                asin: asin,
            };
        }

        window.postMessage({ type: "order", data }, "*");

        // Wait 500ms following an order to allow for the order report query to go through before the redirect happens.
        await new Promise((r) => setTimeout(r, 500));
        return response;
    }

    // Handle recommendations
    if (url.startsWith("api/recommendations")) {
        try {
            extHelper_responseData = await response.clone().json();
        } catch (e) {
            console.error('[CF] | Failed to read response JSON (recommendations)', e);
            extHelper_responseData = {};
        }

        const result = extHelper_responseData && extHelper_responseData.result ? extHelper_responseData.result : null;
        const error = extHelper_responseData && extHelper_responseData.error ? extHelper_responseData.error : null;

        if (!result) {
            if (error && error.exceptionType) {
                window.postMessage({ type: "error", data: { error: error.exceptionType } }, "*");
            }
            return response;
        }

        // Find if the item is a parent
        if (result.variations !== undefined) {
            // The item has variations and so is a parent, store it for later interceptions
            extHelper_LastParentVariant = result;
        } else if (result.taxValue !== undefined) {
            // The item has an ETV value, let's find out if it's a child or a parent
            const isChild = !!lastParent && !!lastParent.variations && lastParent.variations.some((v) => v.asin == result.asin);
            let data = {
                parent_asin: null,
                asin: result.asin,
                etv: result.taxValue,
            };
            if (isChild && lastParent && lastParent.recommendationId) {
                const m = lastParent.recommendationId.match(/^.+?#(.+?)#.+$/);
                if (m) data.parent_asin = m[1];
            } else {
                extHelper_LastParentVariant = null;
            }
            window.postMessage({ type: "etv", data }, "*");
        }

        let fixed = 0;
        result.variations = result.variations?.map((variation) => {
            if (Object.keys(variation.dimensions || {}).length === 0) {
                variation.dimensions = { asin_no: variation.asin };
                fixed++;
                return variation;
            }

            for (const key in variation.dimensions) {
                // The core issue: special characters at the end of a variation can break Amazon's UI when used in HTML attributes.
                // Make the string safe for an HTML attribute by adjusting problematic patterns.
                if (!variation.dimensions[key].match(/[a-z0-9]$/i)) {
                    variation.dimensions[key] = variation.dimensions[key] + "fixed";
                    fixed++;
                }

                // Any variation with a : or ) without a space after will crash; ensure a space after those characters.
                let newValue = variation.dimensions[key].replace(/([:)])([^\s])/g, "$1 $2");
                if (newValue !== variation.dimensions[key]) {
                    variation.dimensions[key] = newValue;
                    fixed++;
                }

                // Any variation with a / with a space before it will crash; remove the space before.
                newValue = variation.dimensions[key].replace(/(\s[/])/g, "/");
                if (newValue !== variation.dimensions[key]) {
                    variation.dimensions[key] = newValue;
                    fixed++;
                }
            }

            return variation;
        });

        if (fixed > 0) {
            window.postMessage({ type: "infiniteWheelFixed", text: fixed + " variation(s) fixed." }, "*");
        }

        return new Response(JSON.stringify(extHelper_responseData));
    }

    return response;
};
})();
`;
initInjectScript();