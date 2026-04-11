import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAxUmV9ua1NE66xQILaWWl8Os1nnRna1k4",
    authDomain: "kerabeaute-web.firebaseapp.com",
    projectId: "kerabeaute-web",
    storageBucket: "kerabeaute-web.firebasestorage.app",
    messagingSenderId: "136647567082",
    appId: "1:136647567082:web:acd57fc53019fd19c4d993",
    measurementId: "G-ZZLD199M8Z"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Global access for other scripts
window.firebaseAuth = auth;
window.kerabeauteAuthState = {
    ready: false,
    user: null
};

function getCachedUser() {
    const saved = localStorage.getItem('kerabeaute_user');
    if (!saved) return null;
    try {
        return JSON.parse(saved);
    } catch (err) {
        console.warn('Invalid cached user data', err);
        localStorage.removeItem('kerabeaute_user');
        return null;
    }
}

function getCurrentUserFallback() {
    if (auth.currentUser) return auth.currentUser;
    const savedUser = getCachedUser();
    if (savedUser) return savedUser;
    if (!window.kerabeauteAuthState.ready) return undefined;
    return null;
}

function setAuthState(user) {
    window.kerabeauteAuthState.user = user;
    window.kerabeauteAuthState.ready = true;
}

function updateHeaderUI(user) {
    const accountWrap = document.querySelector('.ast-header-account-wrap');
    if (!accountWrap) return;

    const accountLink = accountWrap.querySelector('a');
    if (!accountLink) return;

    // Redirection logic for authenticated vs unauthenticated users
    const fullPath = window.location.pathname.toLowerCase();
    // Remove trailing slash for consistent matching
    const path = fullPath.endsWith('/') && fullPath.length > 1 ? fullPath.slice(0, -1) : fullPath;
    
    console.log("Current path for redirect check:", path);

    const isLoginPage = path.includes('/login');
    const isRegisterPage = path.includes('/register');
    const isMyAccountRoot = path.endsWith('/my-account.html') || path.endsWith('/my-account');
    
    const isAuthPage = isLoginPage || isRegisterPage || isMyAccountRoot;
    const isDashboardPath = path.includes('/dashboard');
    const isProtectedPage = path.includes('/my-account') && !isMyAccountRoot;

    setAuthState(user || null);
    applyWishlistOverride(user);

    if (user) {
        console.log("User is authenticated, checking for redirect...");
        // User is logged in: update header account link
        accountLink.href = "/my-account/dashboard/";

        // Only update links that point to the account root, not every /my-account page.
        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (href === '/my-account' || href === '/my-account/' || href.endsWith('/my-account.html')) {
                link.href = "/my-account/dashboard/";
            }
        });
        
        // Redirect away from login/register if already logged in
        if (isAuthPage) {
            console.log("On auth page while logged in, redirecting to dashboard...");
            window.location.href = "/my-account/dashboard/";
            return;
        }

        // Add Logout button if it doesn't exist
        if (!document.getElementById('auth-logout-btn')) {
            const logoutBtn = document.createElement('a');
            logoutBtn.id = 'auth-logout-btn';
            logoutBtn.href = '#';
            logoutBtn.className = 'auth-logout-link';
            logoutBtn.innerText = 'Logout';
            
            logoutBtn.onclick = async (e) => {
                e.preventDefault();
                try {
                    await signOut(auth);
                    localStorage.removeItem('kerabeaute_user');
                    window.location.href = "/";
                } catch (error) {
                    console.error("Logout error:", error);
                }
            };
            accountWrap.appendChild(logoutBtn);
        }
        
        // Ensure local storage is in sync
        if (!localStorage.getItem('kerabeaute_user')) {
             localStorage.setItem('kerabeaute_user', JSON.stringify({
                uid: user.uid,
                email: user.email
            }));
        }
    } else {
        // User is logged out
        accountLink.href = "/login/";
        const logoutBtn = document.getElementById('auth-logout-btn');
        if (logoutBtn) logoutBtn.remove();
        localStorage.removeItem('kerabeaute_user');
        
        // Redirect if on protected page
        if (isProtectedPage) {
            window.location.href = "/login/";
        }
    }
}

// ─── Wishlist Integration ───────────────────────────────────────────────────
// ShopEngine's wishlist.js checks `shopEngineWishlist.isLoggedIn` to decide
// whether to allow adding to wishlist. On a static export this is always "".
// We override it when Firebase says the user is logged in, and intercept
// the click in the capture phase (before ShopEngine's own listener.

function applyWishlistOverride(user) {
    if (typeof shopEngineWishlist !== 'undefined') {
        shopEngineWishlist.isLoggedIn = user ? "1" : "";
    }
}

function normalizeWishlistItem(item) {
    if (typeof item === 'string' || typeof item === 'number') {
        const id = String(item);
        return { id, name: 'Product', url: '', image: '', price: 0, stock: 'In stock' };
    }

    if (!item || typeof item !== 'object') {
        return { id: '', name: 'Product', url: '', image: '', price: 0, stock: 'In stock' };
    }

    const id = String(item.id || item.pid || item.productId || item.product_id || '');
    const name = String(item.name || item.productName || item.title || 'Product');
    const url = String(item.url || item.permalink || '');
    const image = String(item.image || item.thumbnail || '');
    const price = parseFloat(item.price || item.amount || item.price_html?.replace(/[^\d.]/g, '')) || 0;
    const stock = String(item.stock || 'In stock');

    return { id, name, url, image, price, stock };
}

function getWishlistStorage() {
    const raw = JSON.parse(localStorage.getItem('kerabeaute_wishlist') || '[]');
    if (!Array.isArray(raw)) return [];

    const normalized = raw
        .map(normalizeWishlistItem)
        .filter(item => item.id);

    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
        setWishlistStorage(normalized);
    }

    return normalized;
}

function setWishlistStorage(wishlist) {
    localStorage.setItem('kerabeaute_wishlist', JSON.stringify(wishlist));
}

function removeWishlistItem(pid) {
    const wishlist = getWishlistStorage().filter(item => item.id !== pid);
    setWishlistStorage(wishlist);
    return wishlist;
}

function formatCurrency(value) {
    const amount = parseFloat(value) || 0;
    return `<span class="woocommerce-Price-currencySymbol">₹</span>${amount.toFixed(2)}`;
}

function getProductDataFromButton(btn) {
    const productEl = btn.closest('.product') || btn.closest('li') || btn.closest('.wc-block-grid__product') || btn.closest('.astra-shop-summary-wrap') || document.body;
    const hrefEl = productEl?.querySelector('a.woocommerce-loop-product__link, a[href*="/product/"]');
    const titleEl = productEl?.querySelector('.woocommerce-loop-product__title, h2, .entry-title') || productEl?.querySelector('a.woocommerce-loop-product__link');
    const priceEl = productEl?.querySelector('.price ins .woocommerce-Price-amount.amount, .price .woocommerce-Price-amount.amount, .price .woocommerce-Price-amount');
    const imageEl = productEl?.querySelector('img');
    const stockText = productEl?.classList.contains('instock') ? 'In stock' : productEl?.classList.contains('outofstock') ? 'Out of stock' : 'In stock';

    let price = 0;
    if (priceEl) {
        price = parseFloat(priceEl.textContent.replace(/[^\d.]/g, '')) || 0;
    }

    return {
        id: btn.dataset.pid || productEl?.querySelector('[data-product_id]')?.dataset.productId || '',
        name: titleEl?.textContent?.trim() || 'Product',
        url: hrefEl?.href || '',
        image: imageEl?.src || '',
        price,
        stock: stockText,
    };
}

function updateWishlistButtonState(btn, active) {
    if (!btn) return;
    if (active) {
        btn.classList.add('active');
        btn.classList.remove('inactive');
    } else {
        btn.classList.remove('active');
        btn.classList.add('inactive');
    }
}

function setWishlistButtonState(btn) {
    const pid = btn.dataset.pid;
    if (!pid) return;
    const wishlist = getWishlistStorage();
    updateWishlistButtonState(btn, wishlist.some(item => item.id === pid));
}

function toggleWishlistButton(btn) {
    const pid = btn.dataset.pid;
    if (!pid) return;

    const wishlist = getWishlistStorage();
    const existingIndex = wishlist.findIndex(item => item.id === pid);
    const isActive = existingIndex !== -1;

    if (isActive) {
        const updated = wishlist.filter(item => item.id !== pid);
        setWishlistStorage(updated);
        updateWishlistButtonState(btn, false);
    } else {
        const productData = getProductDataFromButton(btn);
        if (!productData.id) return;

        const updated = wishlist.filter(item => item.id !== pid);
        updated.push(productData);
        setWishlistStorage(updated);
        updateWishlistButtonState(btn, true);
    }

    renderWishlistPage();
}

function renderWishlistPage() {
    const tbody = document.querySelector('.shopengine-wishlist tbody');
    if (!tbody) return;

    const wishlist = getWishlistStorage();
    if (wishlist.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;">Your wishlist is empty.</td></tr>`;
        return;
    }

    tbody.innerHTML = wishlist.map(item => `
        <tr data-pid="${item.id}">
            <td style="vertical-align:middle;">
                <a href="${item.url}" style="display:flex;align-items:center;gap:0.75rem;text-decoration:none;color:inherit;">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width:72px;height:72px;object-fit:cover;border:1px solid #eee;border-radius:8px;">` : ''}
                    <span>${item.name}</span>
                </a>
            </td>
            <td style="vertical-align:middle;">${formatCurrency(item.price)}</td>
            <td style="vertical-align:middle;">${item.stock || 'In stock'}</td>
            <td style="vertical-align:middle;"><button type="button" class="kerabeaute-wishlist-remove button" data-pid="${item.id}" style="background:#e74c3c;color:#fff;border:none;padding:0.5rem 0.85rem;border-radius:6px;cursor:pointer;">Remove</button></td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.kerabeaute-wishlist-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const pid = btn.dataset.pid;
            removeWishlistItem(pid);
            renderWishlistPage();
            restoreWishlistUI();
        });
    });
}

function initWishlistPage() {
    const tbody = document.querySelector('.shopengine-wishlist tbody');
    if (!tbody) return;
    renderWishlistPage();
    document.body.classList.add('kerabeaute-wishlist-page');
}

// Intercept wishlist clicks using capture:true so we run BEFORE ShopEngine
// and handle logged-in clicks locally to avoid ShopEngine login checks.
document.addEventListener('click', (e) => {
    const wishlistBtn = e.target.closest('.shopengine_add_to_list_action, .shopengine-wishlist');
    if (!wishlistBtn) return;

    const user = getCurrentUserFallback();
    if (user === undefined) {
        // Auth state still initializing; allow ShopEngine to handle click for now.
        return;
    }

    if (!user) {
        e.stopImmediatePropagation();
        e.preventDefault();
        alert("Please log in to add products to your wishlist.");
        window.location.href = "/login/";
        return;
    }

    applyWishlistOverride(user);

    // We can handle the UI toggle locally for wishlist hearts when logged in.
    e.stopImmediatePropagation();
    e.preventDefault();
    toggleWishlistButton(wishlistBtn);
}, true); // <-- capture phase: fires before ShopEngine's bubble-phase listener

// Restore wishlist active-state UI on page load (for the red hearts)
function restoreWishlistUI() {
    const wishlist = getWishlistStorage();
    document.querySelectorAll('.shopengine_add_to_list_action, .shopengine-wishlist').forEach(btn => {
        setWishlistButtonState(btn);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    restoreWishlistUI();
    initWishlistPage();
});

// Immediate UI check based on localStorage to avoid flicker
const savedUser = localStorage.getItem('kerabeaute_user');
if (savedUser) {
    const parsedUser = JSON.parse(savedUser);
    updateHeaderUI(parsedUser);
    restoreWishlistUI();
    initWishlistPage();
}

// Watch for auth changes
onAuthStateChanged(auth, (user) => {
    console.log("Auth state changed:", user ? user.email : "Logged Out");
    updateHeaderUI(user);
    restoreWishlistUI();
    renderWishlistPage();
});

