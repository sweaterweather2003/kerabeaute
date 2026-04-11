/* 
  Allows users to set star ratings by clicking on the star elements.
  This is a UI-only implementation for a static site.
*/

/**
 * Star Rating Initialization Script
 * Handles persistent interactive star ratings across the catalog.
 */

window.initKBStars = function() {
    const ratings = document.querySelectorAll('.star-rating');
    
    ratings.forEach(rating => {
        // Find parent product element
        const productLi = rating.closest('li.product') || rating.closest('.product');
        if (!productLi) return;
        
        // Extract Product ID (robust search)
        let productId = productLi.dataset.product_id;
        if (!productId) {
            const postClass = Array.from(productLi.classList).find(c => c.startsWith('post-'));
            if (postClass) productId = postClass.replace('post-', '');
        }
        if (!productId) productId = productLi.dataset.date; // Fallback to our custom date attr
        
        if (!productId) return;
        
        const storageKey = `kb_rating_${productId}`;
        
        // 1. Restore saved rating from localStorage
        const savedRating = localStorage.getItem(storageKey);
        if (savedRating) {
            const percent = parseFloat(savedRating) * 20;
            const innerSpan = rating.querySelector('span');
            if (innerSpan) {
                // Use a slight timeout to ensure theme scripts don't immediately overwrite it
                setTimeout(() => {
                    innerSpan.style.setProperty('width', percent + '%', 'important');
                    const strong = innerSpan.querySelector('.rating');
                    if (strong) strong.innerText = savedRating;
                }, 10);
            }
            // Update data-rating attribute for consistent sorting
            productLi.dataset.rating = savedRating;
        }

        // 2. Attach Click Handler only once, but always restore saved rating
        if (rating.dataset.ratingInited === "true") {
            return;
        }
        rating.dataset.ratingInited = "true";
        
        rating.style.cursor = 'pointer';
        
        rating.addEventListener('click', (e) => {
            const rect = rating.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            
            // Calculate percentage (0-100%) and score (0-5)
            let percent = (x / width) * 100;
            percent = Math.ceil(percent / 20) * 20;
            if (percent > 100) percent = 100;
            if (percent < 0) percent = 0;
            
            const score = (percent / 20).toString();
            
            const innerSpan = rating.querySelector('span');
            if (innerSpan) {
                innerSpan.style.setProperty('width', percent + '%', 'important');
                const strong = innerSpan.querySelector('.rating');
                if (strong) strong.innerText = score;
                
                // Persistence
                localStorage.setItem(storageKey, score);
                
                // Update data-rating for sorting coherence
                productLi.dataset.rating = score;
            }
        });
    });
};

// Initial Load and Re-init on DOM changes
function setupKBStars() {
    window.initKBStars();

    // Re-check periodically for dynamically loaded products (e.g. from AJAX pagination)
    const observer = new MutationObserver(() => {
        window.initKBStars();
    });
    
    // Watch document.body to catch AJAX-loaded products or layout shifts
    observer.observe(document.body, { childList: true, subtree: true });

    // Handle common WooCommerce/Astra AJAX events if jQuery is present
    if (window.jQuery) {
        window.jQuery(document).on('post-load astra-shop-ajax-success updated_checkout updated_cart_totals', function() {
            window.initKBStars();
            // Call again after a delay to ensure theme animations have finished
            setTimeout(window.initKBStars, 500);
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupKBStars);
} else {
    setupKBStars();
}
