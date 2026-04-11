(function() {
    const productMapping = [
        {
            name: 'prolog',
            keywords: ['prolog', 'prolo', 'prolg', 'prologue', 'pro', 'hair growth', 'growth', 'density', 'prowgrowth'],
            url: '/product/prolog/'
        },
        {
            name: 'routine',
            keywords: ['routine', 'routin', 'routne', 'kit', 'regime', 'combo', 'complete care', 'regiment'],
            url: '/product/routine/'
        },
        {
            name: 'roll on',
            keywords: ['roll on', 'rollon', 'roll-on', 'roll', 'on', 'underarm', 'deodorant', 'deo', 'armpit', 'antiperspirant'],
            url: '/product/kerabeaute-roll-on/'
        },
        {
            name: 'serum',
            keywords: ['serum', 'radiante', 'elixir', 'seru', 'radient', 'eli', 'elixer', 'radiant', 'face serum', 'skin serum'],
            url: '/product/radiante-elixir/'
        },
        {
            name: 'hair oil',
            keywords: ['hair oil', 'hairoil', 'hair-oil', 'oil', 'hair', 'rosemary', 'essential oil', 'natural oil'],
            url: '/product-category/hair-oil/'
        }
    ];

    function findMatch(query) {
        if (!query) return null;
        query = query.toLowerCase().trim();
        if (query.length < 2) return null;

        // 1. Exact keyword match
        for (const product of productMapping) {
            if (product.keywords.includes(query)) {
                return product;
            }
        }

        // 2. Starts with match
        for (const product of productMapping) {
            for (const keyword of product.keywords) {
                if (keyword.startsWith(query) || query.startsWith(keyword)) {
                    if (query.length > 2 || keyword.length === query.length) {
                        return product;
                    }
                }
            }
        }

        // 3. Substring match
        for (const product of productMapping) {
            for (const keyword of product.keywords) {
                if (keyword.length > 3 && (keyword.includes(query) || query.includes(keyword))) {
                    return product;
                }
            }
        }
        
        return null;
    }

    function performRedirect(query) {
        const match = findMatch(query);
        if (match) {
            console.log('Match found, redirecting to:', match.url);
            window.location.href = match.url;
            return true;
        } else {
            console.log('No direct match, going to default results.');
            window.location.href = '/get-it-now/';
            return true;
        }
    }

    function interceptSearch(e) {
        const target = e.target;
        const form = target.closest('form');
        if (!form) return;

        // Check if it's a search form
        const isSearchForm = form.classList.contains('is-search-form') || 
                             form.getAttribute('role') === 'search' ||
                             form.querySelector('input[name="s"]') ||
                             form.querySelector('input[type="search"]');
        
        if (isSearchForm) {
            const input = form.querySelector('input[name="s"]') || form.querySelector('input[type="search"]');
            if (input) {
                const query = input.value;
                if (query.trim()) {
                    e.preventDefault();
                    e.stopPropagation();
                    performRedirect(query);
                }
            }
        }
    }

    function handleKeydown(e) {
        if (e.key === 'Enter') {
            const input = e.target;
            if (input.tagName === 'INPUT' && (input.name === 's' || input.type === 'search' || input.classList.contains('is-search-input'))) {
                const query = input.value;
                if (query.trim()) {
                    e.preventDefault();
                    e.stopPropagation();
                    performRedirect(query);
                }
            }
        }
    }

    // Attach listeners
    // Capture phase ensures we see the event before most other scripts
    document.addEventListener('submit', interceptSearch, true);
    document.addEventListener('keydown', handleKeydown, true);

    console.log('Search redirect script initialized.');
})();
