document.addEventListener('DOMContentLoaded', function() {
    const sortSelect = document.querySelector('.woocommerce-ordering select[name="orderby"]');
    const productsContainer = document.querySelector('ul.products');
    if (!sortSelect || !productsContainer) return;

    const pagination = document.querySelector('.woocommerce-pagination');
    const originalProducts = Array.from(productsContainer.children);
    let allProducts = [...originalProducts];
    let otherPagesLoaded = false;

    function getProductId(li) {
        return li.dataset.productId || li.dataset.id || li.dataset.date || Array.from(li.classList).find(c => c.startsWith('post-'))?.replace('post-', '') || null;
    }

    function getSavedRating(li) {
        const productId = getProductId(li);
        if (!productId) return null;
        const rating = localStorage.getItem(`kb_rating_${productId}`);
        return rating ? parseFloat(rating) : null;
    }

    function updateRatingFromStorage(li) {
        const saved = getSavedRating(li);
        if (saved !== null) {
            li.dataset.rating = saved.toString();
        }
    }

    // Set sorting values for Default sort (original order)
    originalProducts.forEach((li, index) => {
        if (!li.dataset.index) li.dataset.index = index;
    });

    /**
     * Load products from other pages to enable cross-page sorting
     */
    async function loadAllPages() {
        if (otherPagesLoaded) return;
        
        const pageLinks = document.querySelectorAll('.woocommerce-pagination a.page-numbers');
        const urls = Array.from(pageLinks)
            .map(a => a.href)
            .filter((href, index, self) => href !== window.location.href && self.indexOf(href) === index);

        for (const url of urls) {
            try {
                const response = await fetch(url);
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const otherProducts = Array.from(doc.querySelectorAll('ul.products li.product'));
                
                // Avoid duplicates by checking data-date (which we use as post ID)
                otherProducts.forEach(newLi => {
                    updateRatingFromStorage(newLi);
                    const exists = allProducts.some(p => p.dataset.date === newLi.dataset.date);
                    if (!exists) {
                        allProducts.push(newLi);
                    }
                });
            } catch (error) {
                console.error('Error loading products from', url, error);
            }
        }
        otherPagesLoaded = true;
    }

    /**
     * Sort products based on criteria
     */
    function sortProducts(criteria) {
        // Refresh properties of local products in allProducts to capture dynamic rating changes
        allProducts.forEach(li => {
            const domElement = productsContainer.querySelector(`li.product[data-date="${li.dataset.date}"]`) || li;
            if (domElement) {
                li.dataset.rating = domElement.dataset.rating || li.dataset.rating || "0";
            }
            if (!li.dataset.rating || li.dataset.rating === '0') {
                updateRatingFromStorage(li);
            }
        });

        let sorted;
        
        switch (criteria) {
            case 'popularity':
            case 'rating':
                // Both popularity and average rating now sort by stars descending
                sorted = [...allProducts].sort((a, b) => parseFloat(b.dataset.rating || 0) - parseFloat(a.dataset.rating || 0));
                break;
            case 'date':
                sorted = [...allProducts].sort((a, b) => parseFloat(b.dataset.date || 0) - parseFloat(a.dataset.date || 0));
                break;
            case 'price':
                sorted = [...allProducts].sort((a, b) => parseFloat(a.dataset.price || 0) - parseFloat(b.dataset.price || 0));
                break;
            case 'price-desc':
                sorted = [...allProducts].sort((a, b) => parseFloat(b.dataset.price || 0) - parseFloat(a.dataset.price || 0));
                break;
            default:
                sorted = originalProducts;
                break;
        }

        // Render sorted products
        productsContainer.innerHTML = '';
        sorted.forEach(li => productsContainer.appendChild(li));

        // Re-initialize stars for the newly added items
        if (window.initKBStars) window.initKBStars();

        // Hide pagination if we are showing all products sorted across pages
        if (criteria !== 'menu_order' && criteria !== 'default') {
            if (pagination) pagination.style.display = 'none';
        } else {
            if (pagination) pagination.style.display = '';
        }
    }

    // Intercept dropdown changes
    sortSelect.addEventListener('change', async function(e) {
        e.preventDefault(); // Stay on page
        const value = this.value;
        
        if (value !== 'menu_order' && value !== 'default') {
            productsContainer.style.opacity = '0.5';
            await loadAllPages();
            productsContainer.style.opacity = '1';
        }
        
        sortProducts(value);
        
        // Ensure the dropdown maintains its selection
        this.value = value;
    });

    // Handle standard WooCommerce form submission if it happens
    const sortForm = document.querySelector('.woocommerce-ordering');
    if (sortForm) {
        sortForm.addEventListener('submit', (e) => e.preventDefault());
    }

    // Check if URL has orderby parameter on load and apply it
    const urlParams = new URLSearchParams(window.location.search);
    const initialSort = urlParams.get('orderby');
    if (initialSort && initialSort !== 'menu_order') {
        sortSelect.value = initialSort;
        loadAllPages().then(() => sortProducts(initialSort));
    }
});
