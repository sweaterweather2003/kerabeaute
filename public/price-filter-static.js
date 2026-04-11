/**
 * Static Price Filter - Client-side product filtering for static sites.
 * Replaces or supplements the WooCommerce Price Filter block on static pages.
 */

(function() {
    'use strict';

    function initStaticPriceFilter() {
        // Target the products on the page
        const productList = document.querySelector('ul.products');
        if (!productList) return;

        const products = Array.from(productList.querySelectorAll('li.product'));
        if (products.length === 0) return;

        // Extract prices and store them on the product elements
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        products.forEach(product => {
            const priceElement = product.querySelector('.price ins .amount bdi, .price .amount:not(del .amount) bdi');
            if (priceElement) {
                // Remove currency symbol and parse number
                const priceText = priceElement.innerText.replace(/[^0-9.]/g, '');
                const price = parseFloat(priceText);
                if (!isNaN(price)) {
                    product.setAttribute('data-price', price);
                    if (price < minPrice) minPrice = price;
                    if (price > maxPrice) maxPrice = price;
                }
            }
        });

        // Global product list for cross-page counting
        const globalProducts = [
            { id: 312, name: 'Kerabeaute Prolog', price: 450 },
            { id: 315, name: 'Kerabeaute Routine', price: 400 },
            { id: 1409, name: 'Kerabeaute Radiante Elixir', price: 360 },
            { id: 1540, name: 'Kerabeaute Roll-On', price: 250 }
        ];

        // Fixed range as requested
        const floorMin = 250;
        const ceilMax = 450;

        // Retrieve persisted values or defaults
        const savedMin = localStorage.getItem('kb_price_filter_min');
        const savedMax = localStorage.getItem('kb_price_filter_max');
        
        const initialMin = savedMin !== null ? parseFloat(savedMin) : floorMin;
        const initialMax = savedMax !== null ? parseFloat(savedMax) : ceilMax;

        // Create the Filter Widget UI
        const filterContainer = document.createElement('div');
        filterContainer.className = 'static-price-filter';
        filterContainer.innerHTML = `
            <h3>Filter by price</h3>
            <div class="price-slider-container">
                <div class="slider-track"></div>
                <div class="slider-track-active"></div>
                <input type="range" id="min-price-slider" min="${floorMin}" max="${ceilMax}" value="${initialMin}" step="10">
                <input type="range" id="max-price-slider" min="${floorMin}" max="${ceilMax}" value="${initialMax}" step="10">
            </div>
            <div class="price-values">
                <span>Min: <b>₹<span id="min-price-display">${initialMin}</span></b></span>
                <span>Max: <b>₹<span id="max-price-display">${initialMax}</span></b></span>
            </div>
            <div class="filter-button-container">
                <button class="static-filter-btn">Reset Filter</button>
            </div>
        `;

        // Inject into sidebar if it exists, otherwise above the products
        const sidebarWrap = document.querySelector('.ast-filter-wrap');
        const secondary = document.getElementById('secondary');
        if (sidebarWrap) {
            // Replaces the placeholder if found
            const placeholder = sidebarWrap.querySelector('.wp-block-woocommerce-price-filter, .wc-block-price-filter');
            if (placeholder) {
                placeholder.parentNode.replaceChild(filterContainer, placeholder);
            } else {
                sidebarWrap.prepend(filterContainer);
            }
        } else if (secondary) {
            secondary.prepend(filterContainer);
        } else {
            productList.parentNode.insertBefore(filterContainer, productList);
        }

        // Slider logic
        const minSlider = filterContainer.querySelector('#min-price-slider');
        const maxSlider = filterContainer.querySelector('#max-price-slider');
        const minDisplay = filterContainer.querySelector('#min-price-display');
        const maxDisplay = filterContainer.querySelector('#max-price-display');
        const activeTrack = filterContainer.querySelector('.slider-track-active');
        const resetBtn = filterContainer.querySelector('.static-filter-btn');

        function applyFilter() {
            const currentMin = parseFloat(minSlider.value);
            const currentMax = parseFloat(maxSlider.value);

            // Persist values
            localStorage.setItem('kb_price_filter_min', currentMin);
            localStorage.setItem('kb_price_filter_max', currentMax);

            // Filter current page products
            let localVisibleCount = 0;
            products.forEach(product => {
                const productPrice = parseFloat(product.getAttribute('data-price'));
                if (isNaN(productPrice) || (productPrice >= currentMin && productPrice <= currentMax)) {
                    product.style.display = '';
                    localVisibleCount++;
                } else {
                    product.style.display = 'none';
                }
            });

            // Calculate global count across all pages
            const globalVisibleCount = globalProducts.filter(p => p.price >= currentMin && p.price <= currentMax).length;

            // Update result count text if it exists
            const resultCount = document.querySelector('.woocommerce-result-count');
            if (resultCount) {
                resultCount.textContent = `Showing range: ₹${currentMin} - ₹${currentMax} (${globalVisibleCount} products globally)`;
            }
        }

        function updateDisplays() {
            let minVal = parseFloat(minSlider.value);
            let maxVal = parseFloat(maxSlider.value);

            // Prevent min slider from crossing max slider
            if (minVal >= maxVal) {
                minVal = maxVal - 10;
                minSlider.value = minVal;
            }

            minDisplay.textContent = minVal;
            maxDisplay.textContent = maxVal;

            // Update active track
            const range = ceilMax - floorMin;
            const percent1 = ((minVal - floorMin) / range) * 100;
            const percent2 = ((maxVal - floorMin) / range) * 100;
            activeTrack.style.left = percent1 + "%";
            activeTrack.style.width = (percent2 - percent1) + "%";
            
            // Apply filtering in real-time
            applyFilter();
        }

        minSlider.addEventListener('input', updateDisplays);
        maxSlider.addEventListener('input', updateDisplays);
        
        // Reset button logic
        resetBtn.addEventListener('click', () => {
            minSlider.value = floorMin;
            maxSlider.value = ceilMax;
            updateDisplays();
        });

        // Initial call to set active track and initial filter
        updateDisplays();
    }

    // Run on both DOMContentLoaded and immediate load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStaticPriceFilter);
    } else {
        initStaticPriceFilter();
    }
})();
