// Ensure the DOM is fully loaded before running script
document.addEventListener('DOMContentLoaded', function() {

    // Get localized data from PHP
    const restUrl = actPostsData.rest_url;
    const postsPerPage = actPostsData.posts_per_page;
    const initialCategoryIdFromPHP = actPostsData.initial_category_id; // Renamed to clearly indicate source
    const initialSortByFromPHP = actPostsData.initial_sort_by;
    const initialSortOrderFromPHP = actPostsData.initial_sort_order;
    const excerptLength = actPostsData.excerpt_length;
    const showCategoryFilter = actPostsData.show_category_filter; // New: boolean from PHP
    const showSortControls = actPostsData.show_sort_controls;     // New: boolean from PHP

    // DOM Elements
    const postGridContainer = document.getElementById('act-posts-grid-container');
    const categorySelect = document.getElementById('act-posts-category-select'); // This element might not exist if show_category_filter is false
    const sortSelect = document.getElementById('act-posts-sort-select');       // This element might not exist if show_sort_controls is false
    const infiniteScrollTrigger = document.getElementById('act-posts-infinite-scroll-trigger');
    const loadingSpinner = document.getElementById('act-posts-loading-spinner');
    const noResultsMessage = document.getElementById('act-posts-no-results');

    // State variables
    let currentPage = 1;
    let isLoading = false;
    let hasMorePosts = true;

    // IMPORTANT: Set initial category/sort based on shortcode or default.
    // If categorySelect exists, its initial 'selected' value will be used.
    // If not, we use the initialCategoryIdFromPHP directly.
    let currentCategoryId = (categorySelect && showCategoryFilter) ? categorySelect.value : initialCategoryIdFromPHP;
 
    let currentOrderBy = (sortSelect && showSortControls) ? sortSelect.value.split('_')[0] : initialSortByFromPHP;
    let currentOrder = (sortSelect && showSortControls) ? sortSelect.value.split('_')[1] : initialSortOrderFromPHP;

    console.log('Initial Category ID (from shortcode/default):', initialCategoryIdFromPHP);
    console.log('Current Category ID (used for API):', currentCategoryId);
    console.log('Initial Sort By:', initialSortByFromPHP);
    console.log('Current Sort By:', currentOrderBy);


    // --- Function to build API URL ---
    function buildApiUrl(page) {
        let url = `${restUrl}?_embed=wp:featuredmedia,author&_fields=title,date,excerpt,content,link,featured_media,_links,_embedded&per_page=${postsPerPage}&page=${page}`;

        if (currentCategoryId) {
            url += `&categories=${currentCategoryId}`;
        }

        if (currentOrderBy === 'author') {
            url += `&orderby=author`;
        } else { // default to date
            url += `&orderby=date`;
        }

        if (currentOrder === 'asc') {
            url += `&order=asc`;
        } else { // default to desc
            url += `&order=desc`;
        }
        console.log('url: ', url);
        return url;
    }

    // --- Function to create a single post panel HTML ---
    function createPostPanelX(post) {
        const panelDiv = document.createElement('div');
        panelDiv.classList.add('post-panel');
console.log('post: ', Object.keys(post));
console.log('link: ' , post.link);
console.log('post._embedded: ', Object.keys(post._embedded));
console.log('post._links:', Object.keys(post._links));
console.log('featured_media: ', post.featured_media);
//console.log('author:', JSON.stringify(post._embedded.author));
console.log('author: ', post._embedded.author[0].name);
console.log('date: ', post.date);
        // Featured Image
        const featuredMedia = post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0];
        if (featuredMedia && featuredMedia.source_url) {
            const img = document.createElement('img');
            img.src = featuredMedia.source_url;
            img.alt = post.title.rendered;
            img.loading = 'lazy'; // Native lazy loading
            panelDiv.appendChild(img);
        }

        // Title
        const titleLink = document.createElement('a');
        titleLink.href = post.link;
        titleLink.innerHTML = post.title.rendered;
        const h3 = document.createElement('h3');
        h3.appendChild(titleLink);
        panelDiv.appendChild(h3);

        // Excerpt/Content
        const p = document.createElement('p');
        const excerpt = post.excerpt.rendered;
        const content = post.content.rendered;

        if (excerpt && excerpt.length > 0) {
            p.innerHTML = excerpt;
        } else if (content) {
            // Strip HTML tags from content before truncating
            const strippedContent = content.replace(/(<([^>]+)>)/gi, "");
            p.textContent = strippedContent.substring(0, excerptLength) + (strippedContent.length > excerptLength ? '...' : '');
        }
        panelDiv.appendChild(p);

        return panelDiv;
    }
    /**
     * Creates an HTML string for a single post panel based on a WordPress REST API post object.
     *
     * @param {object} post - The post object from the WordPress REST API response.
     * @returns {string} The HTML string for the post panel.
     */
    function createPostPanel(post) {
console.log('post._embedded: ', Object.keys(post._embedded));
console.log('post._links:', Object.keys(post._links));
console.log('featured_media: ', post.featured_media);
        const postLink = post.link || '#'; // Fallback link
        const postTitle = post.title?.rendered || 'No Title'; // Optional chaining for safety
        const postDate = post.date ? post.date.split('T')[0] : 'No Date'; // Handle potential missing date

        // Safely get author name using optional chaining
        const authorName = post._embedded?.author?.[0]?.name || 'Unknown Author';

        // --- Helper to strip HTML tags ---
        // This is needed for trimming the content if no excerpt is available
        const getPlainTextFromHtml = (html) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            return tempDiv.textContent || tempDiv.innerText || '';
        };

        // --- Featured Image Logic ---
        let featuredImageHtml = '';
        // Check if 'wp:featuredmedia' exists and has at least one item, and then if it has a source_url
        if (post._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
            const imageUrl = post._embedded['wp:featuredmedia'][0].source_url;
            const imageAlt = post._embedded['wp:featuredmedia'][0].alt_text || postTitle; // Fallback alt text for accessibility
            featuredImageHtml = `
                <div class="post-image-container">
                    <img src="${imageUrl}" alt="${imageAlt}" class="post-featured-image">
                </div>
            `;
        }

        // --- Excerpt or Content Summary Logic ---
        let summaryContent = '';
        const MAX_SUMMARY_LENGTH = 180; // Adjust this value as needed

        // Prioritize rendered excerpt
        if (post.excerpt?.rendered && getPlainTextFromHtml(post.excerpt.rendered).trim() !== '') {
            summaryContent = post.excerpt.rendered;
            // Check if the excerpt already ends with common ellipsis characters
            // and if it's genuinely shorter than the full content, then add '...'
            const fullContentPlainText = getPlainTextFromHtml(post.content?.rendered || '');
            if (!summaryContent.match(/(\.\.\.|\[\.\.\.\]|\&\#8230;)$/) && getPlainTextFromHtml(summaryContent).length < fullContentPlainText.length) {
                summaryContent += '...';
            }
        } else {
            // Fallback to trimming the full content if no excerpt
            const contentPlain = getPlainTextFromHtml(post.content?.rendered || '');

            if (contentPlain.length > MAX_SUMMARY_LENGTH) {
                summaryContent = contentPlain.substring(0, MAX_SUMMARY_LENGTH).trim();
                // Ensure not to cut a word in half, find last space
                const lastSpace = summaryContent.lastIndexOf(' ');
                if (lastSpace > (MAX_SUMMARY_LENGTH * 0.7)) { // Only trim at space if it's not too far back
                    summaryContent = summaryContent.substring(0, lastSpace);
                }
                summaryContent += '...'; // Add ellipses
            } else {
                summaryContent = contentPlain; // Use full content if it's shorter than max length
            }
        }

        // --- Construct the complete HTML string using template literals ---
        const panelHtmlString = `
            <div class="post-panel">
                <a href="${postLink}">
                    <div class="panel-content">
                        ${featuredImageHtml}
                        <div class="post-text-content">
                            <h3 class="post-title">${postTitle}</h3>
                            <p class="post-meta">
                                <span class="post-date">${postDate}</span>
                                <span class="post-author">${authorName}</span>
                            </p>
                            <div class="post-summary">
                                <p>${summaryContent}</p>
                            </div>
                        </div>
                    </div>
                </a>
            </div>
        `;
        // --- Convert HTML string to a DOM element ---
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = panelHtmlString.trim(); // .trim() to remove any leading/trailing whitespace
        return tempContainer.firstChild; // Return the actual .post-panel div element
    }

    // --- Main function to fetch and display posts ---
    async function fetchAndDisplayPosts(page, clearExisting = false) {
        if (isLoading || !hasMorePosts) return;

        isLoading = true;
        loadingSpinner.style.display = 'block';
        noResultsMessage.style.display = 'none'; // Hide no results message initially

        if (clearExisting) {
            postGridContainer.innerHTML = ''; // Clear existing posts for new filter/sort
        }

        const apiUrl = buildApiUrl(page);

        try {
            const response = await fetch(apiUrl);

            const totalPages = parseInt(response.headers.get('X-WP-TotalPages'));
            const totalPosts = parseInt(response.headers.get('X-WP-Total'));

            const posts = await response.json();

            if (posts.length === 0) {
                hasMorePosts = false;
                if (clearExisting) { // Only show no results if clearing and no posts found
                    noResultsMessage.style.display = 'block';
                }
            } else {
                posts.forEach(post => {
                    const postPanel = createPostPanel(post);
                    postGridContainer.appendChild(postPanel);
                });
            }

            currentPage = page; // Update the current page tracker

            // Check if all posts have been loaded
            if (currentPage >= totalPages || (currentPage * postsPerPage) >= totalPosts) {
                hasMorePosts = false;
                infiniteScrollTrigger.style.display = 'none'; // Hide trigger if no more posts
            } else {
                infiniteScrollTrigger.style.display = 'block'; // Ensure trigger is visible if more posts
            }

        } catch (error) {
            console.error('Error fetching posts:', error);
            hasMorePosts = false; // Stop trying to fetch if there's an error
            if (clearExisting) { // Show message on error if initial load/filter
                noResultsMessage.textContent = 'Error loading posts. Please try again.';
                noResultsMessage.style.display = 'block';
            }
        } finally {
            isLoading = false;
            loadingSpinner.style.display = 'none';
        }
    }

    // --- Event Listeners for Controls ---
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            currentCategoryId = this.value;
            currentPage = 1;
            hasMorePosts = true; // Reset pagination flags
            fetchAndDisplayPosts(1, true); // Fetch new set, clearing existing
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            const [orderBy, order] = this.value.split('_');
            currentOrderBy = orderBy;
            currentOrder = order;
            currentPage = 1;
            hasMorePosts = true; // Reset pagination flags
            fetchAndDisplayPosts(1, true); // Fetch new set, clearing existing
        });
    }

    // --- Intersection Observer Setup for Infinite Scroll ---
    const observerOptions = {
        root: null, // defaults to the viewport
        rootMargin: '0px',
        threshold: 0.1 // When 10% of the trigger is visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            // If the trigger element is intersecting (visible) and we're not already loading
            if (entry.isIntersecting && !isLoading && hasMorePosts) {
                fetchAndDisplayPosts(currentPage + 1);
            }
        });
    }, observerOptions);

    // --- Initial Load ---
    // Only observe and fetch if the grid container exists on the page
    if (postGridContainer) {
        fetchAndDisplayPosts(1, true); // Fetch the first screenful
        observer.observe(infiniteScrollTrigger); // Start observing the trigger element
    }
});