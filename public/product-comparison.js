/**
 * Product Comparison Logic for Kerabeaute
 * Handles product selection, state management (localStorage), and side-by-side modal rendering.
 */

(function() {
    const STORAGE_KEY = 'kb_comparison_list';
    const MAX_COMPARE = 4;
    let comparisonList = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

    const UI = {
        modal: null,
        grid: null,
        
        init() {
            this.createModal();
            this.attachListeners();
            this.updateButtonVisibility();
            this.observeDOM();
        },

        createModal() {
            if (document.querySelector('.kb-compare-modal')) return;

            const modalHtml = `
                <div class="kb-compare-modal">
                    <div class="kb-compare-container">
                        <button class="kb-compare-close" aria-label="Close">&times;</button>
                        <div class="kb-compare-header">
                            <h2>Compare Products</h2>
                        </div>
                        <div class="kb-compare-grid"></div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            this.modal = document.querySelector('.kb-compare-modal');
            this.grid = this.modal.querySelector('.kb-compare-grid');

            this.modal.querySelector('.kb-compare-close').addEventListener('click', () => this.toggleModal(false));
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.toggleModal(false);
            });
        },

        toggleModal(show = true) {
            if (show) {
                this.render();
                this.modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            } else {
                this.modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        },

        attachListeners() {
            // Use capturing phase (true) to intercept before ShopEngine's listeners
            document.addEventListener('click', (e) => {
                // Comparison Logic
                const compareBtn = e.target.closest('.shopengine_comparison_add_to_list_action');
                if (compareBtn) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.handleCompareClick(compareBtn);
                    return;
                }

                // Wishlist Toggle simulation
                const wishlistBtn = e.target.closest('.shopengine-wishlist');
                if (wishlistBtn) {
                    e.preventDefault();
                    wishlistBtn.classList.toggle('active');
                }
            }, true);
        },

        observeDOM() {
            const observer = new MutationObserver(() => {
                this.updateButtonVisibility();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        },

        handleCompareClick(btn) {
            const productEl = btn.closest('.product');
            if (!productEl) return;

            // Extract data
            const id = btn.getAttribute('data-payload') ? JSON.parse(btn.getAttribute('data-payload')).pid : Date.now();
            const title = productEl.querySelector('.woocommerce-loop-product__title')?.innerText || 'Product';
            const price = productEl.querySelector('.price')?.innerText || '';
            const image = productEl.querySelector('.astra-shop-thumbnail-wrap img')?.src || '';
            const link = productEl.querySelector('.ast-loop-product__link')?.href || '#';
            const category = productEl.querySelector('.ast-woo-product-category')?.innerText || '';

            // Availability
            let availability = 'In Stock';
            if (productEl.classList.contains('out-of-stock')) availability = 'Out of Stock';
            else if (productEl.classList.contains('instock')) availability = 'In Stock';

            // Weight
            let weight = 'N/A';
            const variationsData = productEl.querySelector('.cfvsw_variations_form')?.getAttribute('data-product_variations');
            if (variationsData) {
                try {
                    const variations = JSON.parse(variationsData);
                    if (variations.length > 0) {
                        weight = variations[0].weight_html || variations[0].weight || 'N/A';
                        if (weight === 'N/A' || weight === '') {
                             weight = 'N/A';
                        }
                    }
                } catch (e) {}
            }

            // CTA Text
            const ctaBtn = productEl.querySelector('.add_to_cart_button');
            const ctaText = ctaBtn ? ctaBtn.innerText.trim() : 'View Product';

            const existingIndex = comparisonList.findIndex(item => item.id == id);

            if (existingIndex > -1) {
                // Already in list, just open modal
                this.toggleModal(true);
            } else {
                if (comparisonList.length >= MAX_COMPARE) {
                    alert(`You can only compare up to ${MAX_COMPARE} products.`);
                    return;
                }
                
                comparisonList.push({ id, title, price, image, link, category, availability, weight, ctaText });
                this.save();
                this.updateButtonVisibility();
                this.toggleModal(true);
            }
        },

        remove(id) {
            comparisonList = comparisonList.filter(item => item.id != id);
            this.save();
            this.updateButtonVisibility();
            if (comparisonList.length === 0) {
                this.grid.innerHTML = '<div class="kb-compare-empty">Your comparison list is empty.</div>';
            } else {
                this.render();
            }
        },

        save() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(comparisonList));
        },

        updateButtonVisibility() {
            const buttons = document.querySelectorAll('.shopengine_comparison_add_to_list_action');
            buttons.forEach(btn => {
                const payload = btn.getAttribute('data-payload');
                if (payload) {
                    const id = JSON.parse(payload).pid;
                    if (comparisonList.some(item => item.id == id)) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                }
            });
        },

        render() {
            if (comparisonList.length === 0) {
                this.grid.innerHTML = '<div class="kb-compare-empty">No products selected for comparison.</div>';
                return;
            }

            const rows = [
                { label: 'IMAGE', key: 'image', type: 'image' },
                { label: 'PRODUCT NAME', key: 'title', type: 'text' },
                { label: 'PRICE', key: 'price', type: 'text' },
                { label: 'ACTION', key: 'ctaText', type: 'button' },
                { label: 'AVAILABILITY', key: 'availability', type: 'text' },
                { label: 'WEIGHT', key: 'weight', type: 'text' }
            ];

            let tableHtml = `
                <div class="kb-compare-table-wrapper">
                    <table class="kb-compare-table">
                        <thead>
                            <tr>
                                <th class="kb-compare-label-cell"></th>
                                ${comparisonList.map(item => `
                                    <th class="kb-compare-product-header">
                                        <button class="kb-compare-remove-link" onclick="window.kbCompare.remove('${item.id}')">
                                            <span class="kb-remove-icon">&times;</span> Remove
                                        </button>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => `
                                <tr class="kb-row-${row.key}">
                                    <td class="kb-compare-label">${row.label}</td>
                                    ${comparisonList.map(item => {
                                        if (row.type === 'image') {
                                            return `<td class="kb-compare-data"><img src="${item.image}" class="kb-compare-img" alt="${item.title}"></td>`;
                                        }
                                        if (row.type === 'button') {
                                            return `<td class="kb-compare-data"><a href="${item.link}" class="kb-compare-buy-btn">${item.ctaText || 'SELECT OPTIONS'}</a></td>`;
                                        }
                                        return `<td class="kb-compare-data">${item[row.key] || 'N/A'}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            this.grid.innerHTML = tableHtml;
        }
    };

    // Expose remove function to global scope for onclick handlers
    window.kbCompare = {
        remove: (id) => UI.remove(id)
    };

    // Initialize UI
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UI.init());
    } else {
        UI.init();
    }
})();
