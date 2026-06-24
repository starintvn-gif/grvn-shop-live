const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8"
};

function corsHeaders(request, env) {
    const origin = request.headers.get("Origin") || "";

    const allowed = [
        env.ALLOWED_ORIGIN || "https://www.grvn.shop",
        "https://www.grvn.shop",
        "https://grvn.shop",
        "https://api.grvn.shop",
        "https://grvn-api.starintvn.workers.dev",
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ];

    const allowOrigin = allowed.includes(origin)
        ? origin
        : (env.ALLOWED_ORIGIN || "https://www.grvn.shop");

    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id",
        "Access-Control-Max-Age": "86400"
    };
}

function jsonResponse(request, env, body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...jsonHeaders,
            ...corsHeaders(request, env)
        }
    });
}

async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return {};
    }
}

async function insertAffiliateEvent(request, env) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    const payload = await readJson(request);

    const pageUrl =
        payload.page_url ||
        payload.pageUrl ||
        payload.url ||
        request.headers.get("Referer") ||
        "";

    const refCode =
        payload.refCode ||
        payload.ref_code ||
        payload.affiliate_code ||
        payload.code ||
        "";

    const sessionId =
        payload.sessionId ||
        payload.session_id ||
        request.headers.get("X-Session-Id") ||
        "";

    const eventType =
        payload.type ||
        payload.event_type ||
        "event";

    const eventName =
        payload.event ||
        payload.eventName ||
        payload.event_name ||
        "frontend_event";

    const productSlug =
        payload.product_slug ||
        payload.productSlug ||
        payload.productId ||
        payload.product_id ||
        null;

    const row = {
        event_type: String(eventType),
        event_name: String(eventName),
        ref_code: refCode ? String(refCode).toUpperCase() : null,
        session_id: sessionId ? String(sessionId) : null,
        product_slug: productSlug ? String(productSlug) : null,
        page_url: pageUrl ? String(pageUrl) : null,
        user_agent: request.headers.get("User-Agent") || null,
        raw_payload: payload
    };

    const cleanUrl = String(env.SUPABASE_URL).trim().replace(/\/$/, "");
    const endpoint = `${cleanUrl}/rest/v1/affiliate_events`;

    let supabaseRes;
    let text;

    try {
        supabaseRes = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                "Prefer": "return=representation"
            },
            body: JSON.stringify(row)
        });

        text = await supabaseRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not reach Supabase",
            detail: String(err),
            endpoint
        }, 500);
    }

    if (!supabaseRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Supabase insert failed",
            status: supabaseRes.status,
            statusText: supabaseRes.statusText,
            detail: text,
            sentRow: row,
            endpoint
        }, 500);
    }

    let inserted = null;

    try {
        inserted = JSON.parse(text);
    } catch {
        inserted = text;
    }

    return jsonResponse(request, env, {
        success: true,
        inserted
    });
}
function getSupabaseEndpoint(env, path) {
    const cleanUrl = String(env.SUPABASE_URL).trim().replace(/\/$/, "");
    return `${cleanUrl}${path}`;
}

function supabaseHeaders(env) {
    return {
        "Content-Type": "application/json",
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    };
}

const PRODUCT_SELECT = [
    "id",
    "slug",
    "name",
    "brand",
    "category",
    "original_price",
    "price",
    "stock",
    "thumbnail_url",
    "detail_image_url",
    "video_url",
    "description",
    "status",
    "default_influencer",
    "default_affiliate",
    "default_clip",
    "campaign",
    "tag",
    "source_url",
    "source_product_code",
    "commission",
    "benefit_rate",
    "created_at"
].join(",");

async function listProducts(request, env) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const limitValue = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isFinite(limitValue)
        ? Math.min(Math.max(limitValue, 1), 100)
        : 50;

    const params = new URLSearchParams();
    params.set("select", PRODUCT_SELECT);
    params.set("status", "eq.active");
    params.set("order", "created_at.desc");
    params.set("limit", String(limit));

    if (category && category !== "all" && category !== "전체") {
        params.set("category", `eq.${category}`);
    }

    const endpoint = getSupabaseEndpoint(env, `/rest/v1/products?${params.toString()}`);

    let supabaseRes;
    let text;

    try {
        supabaseRes = await fetch(endpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        text = await supabaseRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not reach Supabase products endpoint",
            detail: String(err),
            endpoint
        }, 500);
    }

    if (!supabaseRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Supabase products fetch failed",
            status: supabaseRes.status,
            statusText: supabaseRes.statusText,
            detail: text,
            endpoint
        }, 500);
    }

    let products = [];

    try {
        products = JSON.parse(text);
    } catch {
        return jsonResponse(request, env, {
            success: false,
            error: "Products response is not valid JSON",
            raw: text
        }, 500);
    }

    return jsonResponse(request, env, {
        success: true,
        count: products.length,
        products
    });
}
async function listProductOptions(request, env, productId) {
    if (!productId) {
        return [];
    }

    const params = new URLSearchParams();
    params.set("select", "id,product_id,option_name,option_value,additional_price,stock,created_at");
    params.set("product_id", `eq.${productId}`);
    params.set("order", "created_at.asc");

    const endpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/product_options?${params.toString()}`
    );

    let supabaseRes;
    let text = "";

    try {
        supabaseRes = await fetch(endpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        text = await supabaseRes.text();
    } catch (err) {
        console.warn("[GRVN API] product_options fetch failed:", err);
        return [];
    }

    if (!supabaseRes.ok) {
        console.warn("[GRVN API] product_options response failed:", text);
        return [];
    }

    try {
        return text ? JSON.parse(text) : [];
    } catch (err) {
        console.warn("[GRVN API] product_options JSON parse failed:", err);
        return [];
    }
}

async function getProductBySlug(request, env, slug) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    const params = new URLSearchParams();
    params.set("select", PRODUCT_SELECT);
    params.set("slug", `eq.${slug}`);
    params.set("limit", "1");

    const endpoint = getSupabaseEndpoint(env, `/rest/v1/products?${params.toString()}`);

    let supabaseRes;
    let text;

    try {
        supabaseRes = await fetch(endpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        text = await supabaseRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not reach Supabase product detail endpoint",
            detail: String(err),
            endpoint
        }, 500);
    }

    if (!supabaseRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Supabase product detail fetch failed",
            status: supabaseRes.status,
            statusText: supabaseRes.statusText,
            detail: text,
            endpoint
        }, 500);
    }

    let rows = [];

    try {
        rows = JSON.parse(text);
    } catch {
        return jsonResponse(request, env, {
            success: false,
            error: "Product detail response is not valid JSON",
            raw: text
        }, 500);
    }

    if (!rows.length) {
        return jsonResponse(request, env, {
            success: false,
            error: "Product not found",
            slug
        }, 404);
    }

    const product = rows[0];
    const options = await listProductOptions(request, env, product.id);

    product.options = options;

    return jsonResponse(request, env, {
        success: true,
        product
    });
}

/* Admin 상품 API 함수 추가 시작 */

function toSupabaseProduct(adminProduct) {
    const slug = adminProduct.slug || adminProduct.id;

    const detailImage =
        adminProduct.detailImage ||
        adminProduct.detail_image_url ||
        adminProduct.detailImageUrl ||
        "";

    const thumbnail =
        adminProduct.thumbnail ||
        adminProduct.thumbnail_url ||
        detailImage ||
        "";

    return {
        slug: String(slug || "").trim(),
        name: String(adminProduct.name || "").trim(),
        brand: String(adminProduct.brand || "").trim(),
        category: adminProduct.category || "상품",

        original_price: Number(adminProduct.originalPrice || adminProduct.original_price || 0),
        price: Number(adminProduct.price || 0),
        stock: Number(adminProduct.stock || 100),

        thumbnail_url: thumbnail,
        detail_image_url: detailImage,
        video_url: adminProduct.videoUrl || adminProduct.video_url || adminProduct.video || "",

        description: adminProduct.desc || adminProduct.description || "",
        status: adminProduct.status || "active",

        default_influencer: adminProduct.defaultInfluencer || adminProduct.default_influencer || "",
        default_affiliate: adminProduct.defaultAffiliate || adminProduct.default_affiliate || "",
        default_clip: adminProduct.defaultClip || adminProduct.default_clip || "",
        campaign: adminProduct.campaign || "",
        tag: adminProduct.tag || "",
        source_url: adminProduct.sourceUrl || adminProduct.source_url || "",
        source_product_code: adminProduct.sourceProductCode || adminProduct.source_product_code || "",

        commission: Number(adminProduct.commission ?? adminProduct.commission_rate ?? 0.1),
        benefit_rate: Number(adminProduct.benefitRate || adminProduct.benefit_rate || 0)
    };
}

async function listAdminProducts(request, env) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    const params = new URLSearchParams();
    params.set("select", PRODUCT_SELECT);
    params.set("order", "created_at.desc");

    const endpoint = getSupabaseEndpoint(env, `/rest/v1/products?${params.toString()}`);

    let supabaseRes;
    let text = "";

    try {
        supabaseRes = await fetch(endpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        text = await supabaseRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not reach Supabase admin products endpoint",
            detail: String(err),
            endpoint
        }, 500);
    }

    if (!supabaseRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Admin products fetch failed",
            status: supabaseRes.status,
            statusText: supabaseRes.statusText,
            detail: text,
            endpoint
        }, 500);
    }

    let products = [];

    try {
        products = text ? JSON.parse(text) : [];
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Admin products response is not valid JSON",
            raw: text,
            detail: String(err),
            endpoint
        }, 500);
    }

    return jsonResponse(request, env, {
        success: true,
        count: products.length,
        products
    });
}

async function saveAdminProduct(request, env) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    const payload = await readJson(request);
    const product = payload.product || payload;

    if (!product.name || !product.brand || !product.price) {
        return jsonResponse(request, env, {
            success: false,
            error: "brand, name, price are required"
        }, 400);
    }

    const row = toSupabaseProduct(product);

    if (!row.slug) {
        return jsonResponse(request, env, {
            success: false,
            error: "slug or id is required",
            sentRow: row
        }, 400);
    }

    const endpoint = getSupabaseEndpoint(env, `/rest/v1/products?on_conflict=slug`);

    let supabaseRes;
    let text = "";

    try {
        supabaseRes = await fetch(endpoint, {
            method: "POST",
            headers: {
                ...supabaseHeaders(env),
                "Prefer": "resolution=merge-duplicates,return=representation"
            },
            body: JSON.stringify(row)
        });

        text = await supabaseRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not reach Supabase admin product save endpoint",
            detail: String(err),
            sentRow: row,
            endpoint
        }, 500);
    }

    if (!supabaseRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Admin product save failed",
            status: supabaseRes.status,
            statusText: supabaseRes.statusText,
            detail: text,
            sentRow: row,
            endpoint
        }, 500);
    }

    let saved = null;

    try {
        const parsed = text ? JSON.parse(text) : [];
        saved = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Admin product save response is not valid JSON",
            raw: text,
            detail: String(err),
            endpoint
        }, 500);
    }

    return jsonResponse(request, env, {
        success: true,
        product: saved
    });
}

async function inactiveAdminProduct(request, env) {
    try {
        if (!env.SUPABASE_URL) {
            return jsonResponse(request, env, {
                success: false,
                error: "Missing SUPABASE_URL"
            }, 500);
        }

        if (!env.SUPABASE_SERVICE_ROLE_KEY) {
            return jsonResponse(request, env, {
                success: false,
                error: "Missing SUPABASE_SERVICE_ROLE_KEY"
            }, 500);
        }

        const payload = await readJson(request);
        const slug = payload.slug || payload.id || payload.productSlug || "";

        if (!slug) {
            return jsonResponse(request, env, {
                success: false,
                error: "slug is required",
                received: payload
            }, 400);
        }

        const params = new URLSearchParams();
        params.set("slug", `eq.${slug}`);

        const endpoint = getSupabaseEndpoint(
            env,
            `/rest/v1/products?${params.toString()}`
        );

        const supabaseRes = await fetch(endpoint, {
            method: "PATCH",
            headers: {
                ...supabaseHeaders(env),
                "Prefer": "return=representation"
            },
            body: JSON.stringify({
                status: "inactive"
            })
        });

        const text = await supabaseRes.text();

        if (!supabaseRes.ok) {
            return jsonResponse(request, env, {
                success: false,
                error: "Admin product inactive failed",
                status: supabaseRes.status,
                statusText: supabaseRes.statusText,
                detail: text,
                slug,
                endpoint
            }, 500);
        }

        let updated = null;

        try {
            const parsed = text ? JSON.parse(text) : [];
            updated = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch (err) {
            return jsonResponse(request, env, {
                success: false,
                error: "Inactive response is not valid JSON",
                raw: text,
                detail: String(err),
                endpoint
            }, 500);
        }

        return jsonResponse(request, env, {
            success: true,
            product: updated
        });
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "inactiveAdminProduct crashed",
            detail: String(err),
            stack: err && err.stack ? String(err.stack) : null
        }, 500);
    }
}

async function listAdminProductOptions(request, env) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    const url = new URL(request.url);
    const productId = url.searchParams.get("product_id") || url.searchParams.get("productId") || "";

    if (!productId) {
        return jsonResponse(request, env, {
            success: false,
            error: "product_id is required"
        }, 400);
    }

    const params = new URLSearchParams();
    params.set("select", "id,product_id,option_name,option_value,additional_price,stock,created_at");
    params.set("product_id", `eq.${productId}`);
    params.set("order", "created_at.asc");

    const endpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/product_options?${params.toString()}`
    );

    let supabaseRes;
    let text = "";

    try {
        supabaseRes = await fetch(endpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        text = await supabaseRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not reach Supabase product_options endpoint",
            detail: String(err),
            product_id: productId,
            endpoint
        }, 500);
    }

    if (!supabaseRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Admin product options fetch failed",
            status: supabaseRes.status,
            statusText: supabaseRes.statusText,
            detail: text,
            product_id: productId,
            endpoint
        }, 500);
    }

    let options = [];

    try {
        options = text ? JSON.parse(text) : [];
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Product options response is not valid JSON",
            raw: text,
            detail: String(err),
            endpoint
        }, 500);
    }

    return jsonResponse(request, env, {
        success: true,
        count: options.length,
        options
    });
}

async function saveAdminProductOptions(request, env) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    const payload = await readJson(request);
    const productId = payload.product_id || payload.productId || "";
    const options = Array.isArray(payload.options) ? payload.options : [];

    if (!productId) {
        return jsonResponse(request, env, {
            success: false,
            error: "product_id is required",
            received: payload
        }, 400);
    }

    if (!options.length) {
        return jsonResponse(request, env, {
            success: false,
            error: "options array is required",
            received: payload
        }, 400);
    }

    const rows = options
        .map((option) => ({
            product_id: productId,
            option_name: String(option.option_name || option.optionName || option.name || "기본 옵션").trim(),
            option_value: String(option.option_value || option.optionValue || option.value || "").trim(),
            additional_price: Number(option.additional_price || option.additionalPrice || 0),
            stock: Number(option.stock || 0)
        }))
        .filter((row) => row.option_name && row.option_value);

    if (!rows.length) {
        return jsonResponse(request, env, {
            success: false,
            error: "No valid option rows",
            received: options
        }, 400);
    }

    const deleteParams = new URLSearchParams();
    deleteParams.set("product_id", `eq.${productId}`);

    const deleteEndpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/product_options?${deleteParams.toString()}`
    );

    try {
        const deleteRes = await fetch(deleteEndpoint, {
            method: "DELETE",
            headers: supabaseHeaders(env)
        });

        const deleteText = await deleteRes.text();

        if (!deleteRes.ok) {
            return jsonResponse(request, env, {
                success: false,
                error: "Existing product options delete failed",
                status: deleteRes.status,
                statusText: deleteRes.statusText,
                detail: deleteText,
                product_id: productId,
                endpoint: deleteEndpoint
            }, 500);
        }
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not delete existing product options",
            detail: String(err),
            product_id: productId,
            endpoint: deleteEndpoint
        }, 500);
    }

    const insertEndpoint = getSupabaseEndpoint(env, "/rest/v1/product_options");

    let supabaseRes;
    let text = "";

    try {
        supabaseRes = await fetch(insertEndpoint, {
            method: "POST",
            headers: {
                ...supabaseHeaders(env),
                "Prefer": "return=representation"
            },
            body: JSON.stringify(rows)
        });

        text = await supabaseRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not insert product options",
            detail: String(err),
            sentRows: rows,
            endpoint: insertEndpoint
        }, 500);
    }

    if (!supabaseRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Admin product options save failed",
            status: supabaseRes.status,
            statusText: supabaseRes.statusText,
            detail: text,
            sentRows: rows,
            endpoint: insertEndpoint
        }, 500);
    }

    let saved = [];

    try {
        saved = text ? JSON.parse(text) : [];
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Product options save response is not valid JSON",
            raw: text,
            detail: String(err),
            endpoint: insertEndpoint
        }, 500);
    }

    return jsonResponse(request, env, {
        success: true,
        count: Array.isArray(saved) ? saved.length : 1,
        options: saved
    });
}
function createOrderNo() {
    const now = new Date();

    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const datePart = `${yyyy}${mm}${dd}`;
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

    return `GRVN-${datePart}-${randomPart}`;
}

function normalizeCommissionRate(value) {
    const n = Number(value);

    if (!Number.isFinite(n)) {
        return 0.1;
    }

    if (n > 1) {
        return n / 100;
    }

    return n;
}

async function createOrder(request, env) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    const payload = await readJson(request);

    const productSlug =
        payload.product_slug ||
        payload.productSlug ||
        payload.product ||
        payload.productId ||
        "";

    const qty = Math.max(Number(payload.qty || payload.quantity || 1), 1);

    const refCode =
        payload.ref_code ||
        payload.refCode ||
        payload.code ||
        "";

    const optionName =
        payload.option_name ||
        payload.optionName ||
        "기본 옵션";

    const optionValue =
        payload.option_value ||
        payload.optionValue ||
        payload.option ||
        "상세페이지 기준 옵션 선택";

    if (!productSlug) {
        return jsonResponse(request, env, {
            success: false,
            error: "product_slug is required",
            received: payload
        }, 400);
    }

    /*
      1) 상품 조회
    */
    const productParams = new URLSearchParams();
    productParams.set(
        "select",
        "id,slug,name,brand,category,price,stock,status,default_influencer,default_affiliate,commission"
    );
    productParams.set("slug", `eq.${productSlug}`);
    productParams.set("status", "eq.active");
    productParams.set("limit", "1");

    const productEndpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/products?${productParams.toString()}`
    );

    let productRes;
    let productText = "";

    try {
        productRes = await fetch(productEndpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        productText = await productRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not reach Supabase products endpoint",
            detail: String(err),
            endpoint: productEndpoint
        }, 500);
    }

    if (!productRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Product fetch failed",
            status: productRes.status,
            detail: productText,
            endpoint: productEndpoint
        }, 500);
    }

    let products = [];

    try {
        products = productText ? JSON.parse(productText) : [];
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Product response is not valid JSON",
            raw: productText,
            detail: String(err)
        }, 500);
    }

    if (!products.length) {
        return jsonResponse(request, env, {
            success: false,
            error: "Product not found or inactive",
            product_slug: productSlug
        }, 404);
    }

    const product = products[0];

    /*
      2) 금액 계산
    */
    const unitPrice = Number(product.price || 0);
    const productTotal = unitPrice * qty;
    const shippingFee = Number(payload.shipping_fee || payload.shippingFee || 0);
    const paymentTotal = productTotal + shippingFee;

    const commissionRate = normalizeCommissionRate(
        payload.commission_rate ||
        payload.commissionRate ||
        product.commission ||
        0.1
    );

    const commissionAmount = Math.round(productTotal * commissionRate);

    const orderNo = createOrderNo();

    /*
      3) orders 생성
    */
    const orderRow = {
        order_no: orderNo,
        status: "pending",

        buyer_name: payload.buyer_name || payload.buyerName || null,
        buyer_phone: payload.buyer_phone || payload.buyerPhone || null,
        buyer_email: payload.buyer_email || payload.buyerEmail || null,

        ref_code: refCode ? String(refCode).toUpperCase() : null,
        influencer_name:
            payload.influencer_name ||
            payload.influencerName ||
            product.default_influencer ||
            null,

        product_total: productTotal,
        shipping_fee: shippingFee,
        payment_total: paymentTotal,
        commission_amount: commissionAmount,

        page_url:
            payload.page_url ||
            payload.pageUrl ||
            request.headers.get("Referer") ||
            null,

        raw_payload: payload
    };

    const orderEndpoint = getSupabaseEndpoint(env, "/rest/v1/orders");

    let orderRes;
    let orderText = "";

    try {
        orderRes = await fetch(orderEndpoint, {
            method: "POST",
            headers: {
                ...supabaseHeaders(env),
                "Prefer": "return=representation"
            },
            body: JSON.stringify(orderRow)
        });

        orderText = await orderRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not create order",
            detail: String(err),
            sentRow: orderRow,
            endpoint: orderEndpoint
        }, 500);
    }

    if (!orderRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order create failed",
            status: orderRes.status,
            statusText: orderRes.statusText,
            detail: orderText,
            sentRow: orderRow,
            endpoint: orderEndpoint
        }, 500);
    }

    let order = null;

    try {
        const parsed = orderText ? JSON.parse(orderText) : [];
        order = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order create response is not valid JSON",
            raw: orderText,
            detail: String(err)
        }, 500);
    }

    if (!order || !order.id) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order was created but order id is missing",
            raw: order
        }, 500);
    }

    /*
      4) order_items 생성
    */
    const itemRow = {
        order_id: order.id,

        product_id: product.id,
        product_slug: product.slug,
        product_name: product.name,
        brand: product.brand,

        option_name: optionName,
        option_value: optionValue,

        qty,
        unit_price: unitPrice,
        total_price: productTotal,

        commission_rate: commissionRate,
        commission_amount: commissionAmount
    };

    const itemEndpoint = getSupabaseEndpoint(env, "/rest/v1/order_items");

    let itemRes;
    let itemText = "";

    try {
        itemRes = await fetch(itemEndpoint, {
            method: "POST",
            headers: {
                ...supabaseHeaders(env),
                "Prefer": "return=representation"
            },
            body: JSON.stringify(itemRow)
        });

        itemText = await itemRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not create order item",
            detail: String(err),
            order,
            sentRow: itemRow,
            endpoint: itemEndpoint
        }, 500);
    }

    if (!itemRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order item create failed",
            status: itemRes.status,
            statusText: itemRes.statusText,
            detail: itemText,
            order,
            sentRow: itemRow,
            endpoint: itemEndpoint
        }, 500);
    }

    let orderItem = null;

    try {
        const parsed = itemText ? JSON.parse(itemText) : [];
        orderItem = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order item response is not valid JSON",
            raw: itemText,
            detail: String(err),
            order
        }, 500);
    }

    return jsonResponse(request, env, {
        success: true,
        order,
        item: orderItem,
        summary: {
            order_no: order.order_no,
            status: order.status,
            product_slug: product.slug,
            product_name: product.name,
            qty,
            unit_price: unitPrice,
            product_total: productTotal,
            shipping_fee: shippingFee,
            payment_total: paymentTotal,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            ref_code: order.ref_code
        }
    });
}

async function getOrderByNo(request, env, orderNo) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    if (!orderNo) {
        return jsonResponse(request, env, {
            success: false,
            error: "order_no is required"
        }, 400);
    }

    const orderParams = new URLSearchParams();
    orderParams.set("select", "*");
    orderParams.set("order_no", `eq.${orderNo}`);
    orderParams.set("limit", "1");

    const orderEndpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/orders?${orderParams.toString()}`
    );

    let orderRes;
    let orderText = "";

    try {
        orderRes = await fetch(orderEndpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        orderText = await orderRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not fetch order",
            detail: String(err),
            endpoint: orderEndpoint
        }, 500);
    }

    if (!orderRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order fetch failed",
            status: orderRes.status,
            detail: orderText,
            endpoint: orderEndpoint
        }, 500);
    }

    let orders = [];

    try {
        orders = orderText ? JSON.parse(orderText) : [];
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order response is not valid JSON",
            raw: orderText,
            detail: String(err)
        }, 500);
    }

    if (!orders.length) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order not found",
            order_no: orderNo
        }, 404);
    }

    const order = orders[0];

    const itemParams = new URLSearchParams();
    itemParams.set("select", "*");
    itemParams.set("order_id", `eq.${order.id}`);

    const itemEndpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/order_items?${itemParams.toString()}`
    );

    let itemRes;
    let itemText = "";

    try {
        itemRes = await fetch(itemEndpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        itemText = await itemRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not fetch order items",
            detail: String(err),
            order,
            endpoint: itemEndpoint
        }, 500);
    }

    if (!itemRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order items fetch failed",
            status: itemRes.status,
            detail: itemText,
            order,
            endpoint: itemEndpoint
        }, 500);
    }

    let items = [];

    try {
        items = itemText ? JSON.parse(itemText) : [];
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order items response is not valid JSON",
            raw: itemText,
            detail: String(err),
            order
        }, 500);
    }

    return jsonResponse(request, env, {
        success: true,
        order,
        items
    });
}

function getPortOnePaidAmount(payment) {
    return Number(
        payment?.amount?.total ||
        payment?.amount?.paid ||
        payment?.totalAmount ||
        payment?.paidAmount ||
        payment?.paid_amount ||
        0
    );
}

function getPortOnePaymentStatus(payment) {
    return String(
        payment?.status ||
        payment?.paymentStatus ||
        payment?.payment_status ||
        ''
    ).toUpperCase();
}

async function verifyPortOnePayment(request, env) {
    if (!env.SUPABASE_URL) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_URL"
        }, 500);
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing SUPABASE_SERVICE_ROLE_KEY"
        }, 500);
    }

    if (!env.PORTONE_API_SECRET) {
        return jsonResponse(request, env, {
            success: false,
            error: "Missing PORTONE_API_SECRET"
        }, 500);
    }

    const payload = await readJson(request);

    const orderNo = payload.order_no || payload.orderNo || "";
    const paymentId = payload.payment_id || payload.paymentId || "";

    if (!orderNo || !paymentId) {
        return jsonResponse(request, env, {
            success: false,
            error: "order_no and payment_id are required",
            received: payload
        }, 400);
    }

    /*
      1) GRVN orders 테이블에서 주문번호 조회
    */
    const orderParams = new URLSearchParams();
    orderParams.set("select", "*");
    orderParams.set("order_no", `eq.${orderNo}`);
    orderParams.set("limit", "1");

    const orderEndpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/orders?${orderParams.toString()}`
    );

    let orderRes;
    let orderText = "";

    try {
        orderRes = await fetch(orderEndpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        orderText = await orderRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not fetch order",
            detail: String(err),
            endpoint: orderEndpoint
        }, 500);
    }

    if (!orderRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order fetch failed",
            status: orderRes.status,
            statusText: orderRes.statusText,
            detail: orderText,
            endpoint: orderEndpoint
        }, 500);
    }

    let orders = [];

    try {
        orders = orderText ? JSON.parse(orderText) : [];
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order response JSON parse failed",
            raw: orderText,
            detail: String(err)
        }, 500);
    }

    if (!orders.length) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order not found",
            order_no: orderNo
        }, 404);
    }

    const order = orders[0];

    /*
      2) PortOne V2 결제 단건 조회
      paymentId는 프론트에서 PortOne.requestPayment()에 보낸 paymentId와 동일합니다.
      현재 구조에서는 paymentId = order_no 로 사용합니다.
    */
    const portoneEndpoint =
        `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`;

    let portoneRes;
    let portoneText = "";

    try {
        portoneRes = await fetch(portoneEndpoint, {
            method: "GET",
            headers: {
                "Authorization": `PortOne ${env.PORTONE_API_SECRET}`,
                "Content-Type": "application/json"
            }
        });

        portoneText = await portoneRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not reach PortOne payment endpoint",
            detail: String(err),
            payment_id: paymentId,
            endpoint: portoneEndpoint
        }, 500);
    }

    if (!portoneRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "PortOne payment fetch failed",
            status: portoneRes.status,
            statusText: portoneRes.statusText,
            detail: portoneText,
            payment_id: paymentId,
            endpoint: portoneEndpoint
        }, 500);
    }

    let payment = null;

    try {
        payment = portoneText ? JSON.parse(portoneText) : null;
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "PortOne response JSON parse failed",
            raw: portoneText,
            detail: String(err)
        }, 500);
    }

    /*
      3) 결제 상태 / 금액 검증
    */
    const paymentStatus = getPortOnePaymentStatus(payment);
    const paidAmount = getPortOnePaidAmount(payment);
    const expectedAmount = Number(order.payment_total || 0);

    const isPaid =
        paymentStatus === "PAID" ||
        paymentStatus === "PAYED" ||
        paymentStatus === "PAID_OUT";

    if (!isPaid) {
        return jsonResponse(request, env, {
            success: false,
            error: "Payment is not paid",
            payment_status: paymentStatus,
            payment
        }, 400);
    }

    if (paidAmount !== expectedAmount) {
        return jsonResponse(request, env, {
            success: false,
            error: "Payment amount mismatch",
            paid_amount: paidAmount,
            expected_amount: expectedAmount,
            order_no: orderNo,
            payment_id: paymentId,
            payment
        }, 400);
    }

    /*
      4) payments 테이블에 결제검증 결과 저장
    */
    const paymentRow = {
        order_id: order.id,
        payment_provider: "portone",
        payment_id: paymentId,
        merchant_uid: paymentId,
        payment_status: paymentStatus || "PAID",
        paid_amount: paidAmount,
        currency: "KRW",
        verified_at: new Date().toISOString(),
        raw_payload: {
            portone_payment: payment,
            client_payload: payload
        }
    };

    const paymentEndpoint = getSupabaseEndpoint(env, "/rest/v1/payments");

    let paymentInsertRes;
    let paymentInsertText = "";

    try {
        paymentInsertRes = await fetch(paymentEndpoint, {
            method: "POST",
            headers: {
                ...supabaseHeaders(env),
                "Prefer": "return=representation"
            },
            body: JSON.stringify(paymentRow)
        });

        paymentInsertText = await paymentInsertRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not insert payment row",
            detail: String(err),
            sentRow: paymentRow,
            endpoint: paymentEndpoint
        }, 500);
    }

    if (!paymentInsertRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Payment insert failed",
            status: paymentInsertRes.status,
            statusText: paymentInsertRes.statusText,
            detail: paymentInsertText,
            sentRow: paymentRow,
            endpoint: paymentEndpoint
        }, 500);
    }

    let savedPayment = null;

    try {
        const parsed = paymentInsertText ? JSON.parse(paymentInsertText) : [];
        savedPayment = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Payment insert response JSON parse failed",
            raw: paymentInsertText,
            detail: String(err)
        }, 500);
    }

    /*
      5) orders.status = paid 로 변경
    */
    const updateParams = new URLSearchParams();
    updateParams.set("id", `eq.${order.id}`);

    const orderUpdateEndpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/orders?${updateParams.toString()}`
    );

    let orderUpdateRes;
    let orderUpdateText = "";

    try {
        orderUpdateRes = await fetch(orderUpdateEndpoint, {
            method: "PATCH",
            headers: {
                ...supabaseHeaders(env),
                "Prefer": "return=representation"
            },
            body: JSON.stringify({
                status: "paid",
                updated_at: new Date().toISOString()
            })
        });

        orderUpdateText = await orderUpdateRes.text();
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Worker could not update order status",
            detail: String(err),
            payment: savedPayment,
            endpoint: orderUpdateEndpoint
        }, 500);
    }

    if (!orderUpdateRes.ok) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order status update failed",
            status: orderUpdateRes.status,
            statusText: orderUpdateRes.statusText,
            detail: orderUpdateText,
            payment: savedPayment,
            endpoint: orderUpdateEndpoint
        }, 500);
    }

    let updatedOrder = null;

    try {
        const parsed = orderUpdateText ? JSON.parse(orderUpdateText) : [];
        updatedOrder = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (err) {
        return jsonResponse(request, env, {
            success: false,
            error: "Order update response JSON parse failed",
            raw: orderUpdateText,
            detail: String(err),
            payment: savedPayment
        }, 500);
    }

    return jsonResponse(request, env, {
        success: true,
        order: updatedOrder,
        payment: savedPayment,
        portone: payment
    });
}

/* Admin 상품 API 함수 추가 끝 */

async function handleTossPaymentConfirm(request, env) {
    try {
        const body = await readJson(request);

        const paymentKey = body.paymentKey;
        const orderId = body.orderId;
        const amount = Number(body.amount);
        const lastOrder = body.lastOrder || null;

        if (!paymentKey || !orderId || !amount) {
            return jsonResponse(request, env, {
                success: false,
                message: "paymentKey, orderId, amount 값이 필요합니다."
            }, 400);
        }

        if (!env.TOSS_SECRET_KEY) {
            return jsonResponse(request, env, {
                success: false,
                message: "TOSS_SECRET_KEY가 Cloudflare Worker Secret에 설정되지 않았습니다."
            }, 500);
        }

        if (lastOrder && Number(lastOrder.amount) !== amount) {
            return jsonResponse(request, env, {
                success: false,
                message: "주문금액과 결제금액이 일치하지 않습니다.",
                expected: Number(lastOrder.amount),
                received: amount
            }, 400);
        }

        const encodedSecretKey = btoa(env.TOSS_SECRET_KEY + ":");

        const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
            method: "POST",
            headers: {
                "Authorization": "Basic " + encodedSecretKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                paymentKey,
                orderId,
                amount
            })
        });

        const tossData = await tossRes.json();

        if (!tossRes.ok) {
            console.error("[GRVN] Toss confirm failed:", tossData);

            return jsonResponse(request, env, {
                success: false,
                message: tossData.message || "토스 결제 승인에 실패했습니다.",
                code: tossData.code,
                toss: tossData
            }, tossRes.status);
        }

        const saved = await saveTossPaymentToSupabase(request, env, {
            tossData,
            paymentKey,
            orderId,
            amount,
            lastOrder
        });

        return jsonResponse(request, env, {
            success: true,
            message: saved.alreadySaved
                ? "이미 저장된 결제입니다."
                : "결제가 승인되고 주문 정보가 저장되었습니다.",
            payment: tossData,
            saved
        });

    } catch (error) {
        console.error("[GRVN] handleTossPaymentConfirm error:", error);

        return jsonResponse(request, env, {
            success: false,
            message: error.message || "결제 승인 처리 중 서버 오류가 발생했습니다."
        }, 500);
    }
}

async function saveTossPaymentToSupabase(request, env, args) {
    const { tossData, paymentKey, orderId, amount, lastOrder } = args;

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return {
            saved: false,
            alreadySaved: false,
            reason: "Missing Supabase env"
        };
    }

    /*
      1) 이미 같은 paymentKey가 payments에 저장되어 있는지 확인
      - 새로고침/중복 호출 시 중복 저장 방지
    */
    const existingParams = new URLSearchParams();
    existingParams.set("select", "*");
    existingParams.set("payment_id", `eq.${paymentKey}`);
    existingParams.set("limit", "1");

    const existingPaymentEndpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/payments?${existingParams.toString()}`
    );

    const existingPaymentRes = await fetch(existingPaymentEndpoint, {
        method: "GET",
        headers: supabaseHeaders(env)
    });

    const existingPaymentText = await existingPaymentRes.text();
    let existingPayments = [];

    try {
        existingPayments = existingPaymentText ? JSON.parse(existingPaymentText) : [];
    } catch {
        existingPayments = [];
    }

    if (Array.isArray(existingPayments) && existingPayments.length) {
        return {
            saved: true,
            alreadySaved: true,
            payment: existingPayments[0]
        };
    }

    /*
      2) productSlug 기준으로 상품 정보 조회
    */
    const productSlug =
        lastOrder?.productSlug ||
        lastOrder?.product_slug ||
        "unknown-product";

    let product = null;

    if (productSlug && productSlug !== "unknown-product") {
        const productParams = new URLSearchParams();
        productParams.set(
            "select",
            "id,slug,name,brand,price,commission,default_influencer,default_affiliate"
        );
        productParams.set("slug", `eq.${productSlug}`);
        productParams.set("limit", "1");

        const productEndpoint = getSupabaseEndpoint(
            env,
            `/rest/v1/products?${productParams.toString()}`
        );

        const productRes = await fetch(productEndpoint, {
            method: "GET",
            headers: supabaseHeaders(env)
        });

        const productText = await productRes.text();

        try {
            const products = productText ? JSON.parse(productText) : [];
            product = Array.isArray(products) && products.length ? products[0] : null;
        } catch {
            product = null;
        }
    }

    /*
      3) 주문/상품/수수료 계산
    */
    const qty = Math.max(Number(lastOrder?.qty || 1), 1);
    const unitPrice = Math.round(Number(amount || 0) / qty);
    const totalPrice = Number(amount || 0);

    const commissionRate = normalizeCommissionRate(
        product?.commission || lastOrder?.commissionRate || 0.1
    );

    const commissionAmount = Math.round(totalPrice * commissionRate);

    const refCode =
        lastOrder?.affCode ||
        lastOrder?.refCode ||
        lastOrder?.ref_code ||
        product?.default_affiliate ||
        "GRVN";

    const optionText =
        lastOrder?.option ||
        lastOrder?.optionText ||
        "기본 옵션";

    const productName =
        product?.name ||
        lastOrder?.orderName ||
        tossData?.orderName ||
        "GRVN 상품";

    const brand =
        product?.brand ||
        "GRVN";

    /*
      4) orders 저장
      - order_no는 Toss orderId 사용
      - 이미 같은 order_no가 있으면 merge
    */
    const orderRow = {
        order_no: orderId,
        status: "paid",

        buyer_name: tossData?.customerName || null,
        buyer_phone: tossData?.customerMobilePhone || null,
        buyer_email: tossData?.customerEmail || null,

        ref_code: refCode ? String(refCode).toUpperCase() : null,
        influencer_name: product?.default_influencer || null,

        product_total: totalPrice,
        shipping_fee: 0,
        payment_total: totalPrice,
        commission_amount: commissionAmount,

        page_url: request.headers.get("Referer") || null,

        raw_payload: {
            toss: tossData,
            lastOrder
        },

        updated_at: new Date().toISOString()
    };

    const orderEndpoint = getSupabaseEndpoint(
        env,
        "/rest/v1/orders?on_conflict=order_no"
    );

    const orderRes = await fetch(orderEndpoint, {
        method: "POST",
        headers: {
            ...supabaseHeaders(env),
            "Prefer": "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(orderRow)
    });

    const orderText = await orderRes.text();

    if (!orderRes.ok) {
        throw new Error("orders 저장 실패: " + orderText);
    }

    const savedOrders = orderText ? JSON.parse(orderText) : [];
    const order = Array.isArray(savedOrders) ? savedOrders[0] : savedOrders;

    if (!order || !order.id) {
        throw new Error("orders 저장 후 order.id를 찾을 수 없습니다.");
    }

    /*
      5) order_items 중복 방지
      - 같은 order_id의 기존 item을 삭제 후 다시 저장
    */
    const deleteItemParams = new URLSearchParams();
    deleteItemParams.set("order_id", `eq.${order.id}`);

    const deleteItemEndpoint = getSupabaseEndpoint(
        env,
        `/rest/v1/order_items?${deleteItemParams.toString()}`
    );

    await fetch(deleteItemEndpoint, {
        method: "DELETE",
        headers: supabaseHeaders(env)
    });

    const itemRow = {
        order_id: order.id,

        product_id: product?.id || null,
        product_slug: productSlug,
        product_name: productName,
        brand,

        option_name: "선택 옵션",
        option_value: optionText,

        qty,
        unit_price: unitPrice,
        total_price: totalPrice,

        commission_rate: commissionRate,
        commission_amount: commissionAmount
    };

    const itemEndpoint = getSupabaseEndpoint(env, "/rest/v1/order_items");

    const itemRes = await fetch(itemEndpoint, {
        method: "POST",
        headers: {
            ...supabaseHeaders(env),
            "Prefer": "return=representation"
        },
        body: JSON.stringify(itemRow)
    });

    const itemText = await itemRes.text();

    if (!itemRes.ok) {
        throw new Error("order_items 저장 실패: " + itemText);
    }

    const savedItems = itemText ? JSON.parse(itemText) : [];
    const item = Array.isArray(savedItems) ? savedItems[0] : savedItems;

    /*
      6) payments 저장
    */
    const paymentRow = {
        order_id: order.id,
        payment_provider: "toss",
        payment_id: paymentKey,
        merchant_uid: orderId,
        payment_status: tossData?.status || "DONE",
        paid_amount: totalPrice,
        currency: "KRW",
        verified_at: new Date().toISOString(),
        raw_payload: {
            toss: tossData,
            lastOrder
        },
        updated_at: new Date().toISOString()
    };

    const paymentEndpoint = getSupabaseEndpoint(env, "/rest/v1/payments");

    const paymentRes = await fetch(paymentEndpoint, {
        method: "POST",
        headers: {
            ...supabaseHeaders(env),
            "Prefer": "return=representation"
        },
        body: JSON.stringify(paymentRow)
    });

    const paymentText = await paymentRes.text();

    if (!paymentRes.ok) {
        throw new Error("payments 저장 실패: " + paymentText);
    }

    const savedPayments = paymentText ? JSON.parse(paymentText) : [];
    const payment = Array.isArray(savedPayments) ? savedPayments[0] : savedPayments;

    return {
        saved: true,
        alreadySaved: false,
        order,
        item,
        payment,
        summary: {
            order_no: order.order_no,
            payment_id: paymentKey,
            amount: totalPrice,
            ref_code: refCode,
            product_slug: productSlug,
            product_name: productName
        }
    };
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(request, env)
            });
        }

        if (url.pathname === "/health") {
            return jsonResponse(request, env, {
                status: "ok",
                service: "grvn-api",
                version: "toss-payments-v1",
                message: "GRVN backend API is running"
            });
        }

        if (url.pathname === "/api/payments/confirm" && request.method === "POST") {
            return handleTossPaymentConfirm(request, env);
        }

        if (url.pathname === "/debug/env") {
            return jsonResponse(request, env, {
                has_SUPABASE_URL: !!env.SUPABASE_URL,
                supabase_url: env.SUPABASE_URL || null,
                has_SERVICE_ROLE_KEY: !!env.SUPABASE_SERVICE_ROLE_KEY,
                service_key_prefix: env.SUPABASE_SERVICE_ROLE_KEY
                    ? env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 12) + "..."
                    : null,
                allowed_origin: env.ALLOWED_ORIGIN || null
            });
        }

        if (url.pathname === "/") {
            return jsonResponse(request, env, {
                service: "grvn-api",
                version: "toss-payments-v1",
                available: [
                    "/health",
                    "/debug/env",
                    "POST /api/events",
                    "GET /api/products",
                    "GET /api/products/:slug",
                    "GET /api/admin/products",
                    "POST /api/admin/products",
                    "POST /api/admin/products/inactive",
                    "GET /api/admin/product-options",
                    "POST /api/admin/product-options",
                    "POST /api/orders",
                    "GET /api/orders/:order_no",
                    "POST /api/payments/confirm",
                    "POST /api/payments/verify"
                ]
            });
        }

        if (url.pathname === "/api/events" && request.method === "POST") {
            return insertAffiliateEvent(request, env);
        }
        if (url.pathname === "/api/products" && request.method === "GET") {
            return listProducts(request, env);
        }

        if (url.pathname.startsWith("/api/products/") && request.method === "GET") {
            const slug = decodeURIComponent(url.pathname.replace("/api/products/", ""));
            return getProductBySlug(request, env, slug);
        }

        if (url.pathname === "/api/admin/products" && request.method === "GET") {
            return listAdminProducts(request, env);
        }

        if (url.pathname === "/api/admin/products" && request.method === "POST") {
            return saveAdminProduct(request, env);
        }

        if (url.pathname === "/api/admin/products/inactive" && request.method === "POST") {
            return inactiveAdminProduct(request, env);
        }

        if (url.pathname === "/api/admin/product-options" && request.method === "GET") {
            return listAdminProductOptions(request, env);
        }

        if (url.pathname === "/api/admin/product-options" && request.method === "POST") {
            return saveAdminProductOptions(request, env);
        }

        if (url.pathname === "/api/orders" && request.method === "POST") {
            return createOrder(request, env);
        }

        if (url.pathname.startsWith("/api/orders/") && request.method === "GET") {
            const orderNo = decodeURIComponent(url.pathname.replace("/api/orders/", ""));
            return getOrderByNo(request, env, orderNo);
        }

        if (url.pathname === "/api/payments/verify" && request.method === "POST") {
            return verifyPortOnePayment(request, env);
        }

        return jsonResponse(request, env, {
            error: "Not found",
            path: url.pathname
        }, 404);
    }
};