// Ensure the DOM is fully loaded before running script
document.addEventListener('DOMContentLoaded', async function() {
    // Get localized data from PHP
    const restUrl = actPostsData.rest_url;
    const postsPerPage = actPostsData.posts_per_page; // How many to fetch initially (e.g., 100)
    const initialCategoryIdsFromPHP = actPostsData.initial_category_ids; // Array of IDs
    const initialSortByFromPHP = actPostsData.initial_sort_by;
    const initialSortOrderFromPHP = actPostsData.initial_sort_order;
    const excerptLength = actPostsData.excerpt_length;
    const siteRestUrl = actPostsData.site_rest_url; // Base REST URL for other endpoints like categories
console.log('restUrl:', restUrl);
    // DOM Elements
    const postGridContainer = document.getElementById('act-posts-grid-container');
    const categorySelect = document.getElementById('act-posts-category-select');
    console.log('categorySelect:', categorySelect);
    const categoryCountSpans = document.querySelectorAll('.act-posts-category-count');
    const categoryCheckboxes = document.querySelectorAll('.act-posts-category-checkbox');
    const searchInput = document.getElementById('act-posts-search-input');
    const sortSelect = document.getElementById('act-posts-sort-select');
    const infiniteScrollTrigger = document.getElementById('act-posts-infinite-scroll-trigger');
    const loadingSpinner = document.getElementById('act-posts-loading-spinner');
    const noResultsMessage = document.getElementById('act-posts-no-results');
    const selectedCount = document.getElementById('act-posts-selected');

    // state variables
    //let page = 1;
    let allposts = [];
    let postindex = [];
    let lastpost = 0;
    let displaybusy = false;
    /*
        Selection variables
    */
    let selectedCategoryIds = initialCategoryIdsFromPHP || [];
    /*
     * initialise category selection from values set in PHP
    */
    function initCategorySelect(ids){
        if ( categorySelect ){
            if ( ids && ids.length > 0 ){
                console.log('Initial category IDs (from PHP):', ids);
                for(let option of categorySelect.options){
                    if (ids.includes(option.value)) {
                        console.log('Selecting category:', option.value);
                        option.selected = true;
                    } else if (option.value === '') {
                        option.selected = false; // Ensure 'All Categories' is not selected
                    }
                }
            } else {
                // select All categories
                for(let option of categorySelect.options){
                    if (option.value === '') {
                        option.selected = true; // Ensure 'All Categories' is not selected
                    } else {
                        option.selected = false;
                    }
                }
            }
        }
    }
    initCategorySelect(initialCategoryIdsFromPHP);
    /*
     * Get selected categories from selected options 
    */
    function getSelectedCategories() {
        const selected = [];
        if ( categorySelect ){
            for (let option of categorySelect.options) {
                if (option.selected && option.value !== '') {
                    selected.push(parseInt(option.value, 10));
                }
            }
        }
        return selected;
    }
    /*
     * Initialise sort selection from values set in PHP
    */
    function initSort(sortBy, sortOrder){
        if ( sortSelect ){
            for(let option of sortSelect){
                let a = option.value.split('_');
                let by = a[0];
                let order = a[1];
                if ( by === sortBy && order === sortOrder ) {
                    option.selected = true;
                }
            }
        }
    }
    initSort(initialSortByFromPHP, initialSortOrderFromPHP);
    /*
     * Get selected sort option
     */
    function getSelectedSort() {
        if ( sortSelect ){
            const selected = sortSelect.options[sortSelect.selectedIndex].value;
            const [by, order] = selected.split('_');
            return { by, order };
        } else {
            return { by: 'title', order: 'asc'};
        }
    }
    /*
     * Get filter object from selected categories and search input
    */
    function getFilterObject() {
        const selectedCategories = getSelectedCategories();
        const searchQuery = ( searchInput ? searchInput.value.trim() : '');
        const sort = getSelectedSort();

        return {
            categories: selectedCategories,
            search: searchQuery,
            sortBy: sort.by,
            sortOrder: sort.order
        };
    }
    let filter = getFilterObject();
    console.log('Initial filter:', filter);
    let userlookup = await fetchUserDisplayNamesLookup();
    console.log('userlookup: ', userlookup);
    /*
     * Function to get author name from post object safely.
     * If author is not avaolable, returns 'Unknown Author'.
     */
    function getAuthorName(post, lowercase = false) {
        let author = post.author;
//        let r = post._embedded?.author?.[0]?.name || 'Unknown Author';
        let r = author ? userlookup[author] : 'Unknown Author';
        if ( lowercase ) {
            r = r.toLowerCase();
        } else {
            // capitalise the start of each word
            r = r.replace(/\b\w/g, char => char.toUpperCase());
        }
        return r;
    }
    /*
     * Creates an HTML string for a single post panel based on a WordPress REST API post object.
     *
     * @param {object} post - The post object from the WordPress REST API response.
     * @returns {string} The HTML string for the post panel.
     */
    function createPostPanel(post) {
//console.log('post._embedded: ', Object.keys(post._embedded));
//console.log('post._embedded.author: ', post._embedded.author);
//console.log('post._links:', Object.keys(post._links));
//console.log('featured_media: ', post.featured_media);
//console.log('post.author: ' + post.author);
        const postLink = post.link || '#'; // Fallback link
        const postTitle = post.title?.rendered || 'No Title'; // Optional chaining for safety
        const postDate = post.date ? post.date.split('T')[0] : 'No Date'; // Handle potential missing date

        // Safely get author name using optional chaining
  //      const authorName = post._embedded?.author?.[0]?.name || 'Unknown Author';
        const authorName = getAuthorName(post);

        // --- Helper to strip HTML tags ---
        // This is needed for trimming the content if no excerpt is available
        const getPlainTextFromHtml = (html) => {
            const tempDiv = document.createElement('div');
            try{
                tempDiv.innerHTML = html;
            } catch(e){
                console.log('Error setting innerHTML for post:', postTitle, 'Error:', e);
            }
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
        let panelHtmlString;
        //console.log('post.type: ', post.type)
        if ( post.type !== 'team'){
            panelHtmlString = `
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
        } else {
            panelHtmlString = `
                <div class="post-panel">
                    <a href="${postLink}">
                        <div class="panel-content">
                            ${featuredImageHtml}
                            <div class="post-text-content">
                                <h3 class="post-title">${postTitle}</h3>
                                <div class="post-summary">
                                    <p>${summaryContent}</p>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
            `;
        }
        // --- Convert HTML string to a DOM element ---
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = panelHtmlString.trim(); // .trim() to remove any leading/trailing whitespace
        return tempContainer.firstChild; // Return the actual .post-panel div element
    }
    /**
     * Fetches all users' display names and IDs from the WordPress REST API
     * and returns them as a lookup table.
     * This function hardcodes the REST API root URL.
     *
     * @returns {Promise<Object>} A promise that resolves with an object
     * where keys are user IDs and values are display names.
     * Returns an empty object if an error occurs.
     */
    async function fetchUserDisplayNamesLookup() {
        try {
            // IMPORTANT: Replace 'https://your-domain.com' with your actual WordPress site URL.
            const usersEndpoint = 'wp/v2/users';
            
            const apiUrl = `${siteRestUrl}${usersEndpoint}`;
            console.log('apiUrl: ', apiUrl);
            
            // Parameters to ensure we get all users and only relevant fields
            // 'per_page=100' fetches up to 100 users. Adjust if you have more.
            // 'context=embed' provides basic user info, including 'name' (display name).
            // 'fields=id,name' requests only the ID and name for efficiency.
            const response = await fetch(`${apiUrl}?per_page=100&context=embed&fields=id,name`);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const usersData = await response.json();
            const userLookup = {};

            usersData.forEach(user => {
                userLookup[user.id] = user.name;
            });

            return userLookup;

        } catch (error) {
            console.error("Error fetching user data from REST API:", error);
            return {}; // Return an empty object on error
        }
    }
    // --- Function to build API URL for initial fetch ---
    function buildInitialFetchApiUrl(page){
        // We fetch *all* posts potentially, so no category/search filter here
        // The REST API default max is 100, if more posts exist, you might need a loop or
        // a custom endpoint. For <200 posts, 100 will get a good chunk.
        // For truly ALL posts, you'd need to loop based on X-WP-TotalPages
        //return `${restUrl}?_fields=title,slug,excerpt,content,link,categories,_embedded&_embed=true&per_page=${postsPerPageInitialFetch}&page=1`;
        return `${restUrl}?_embed=wp:featuredmedia,author&_fields=title,categories,date,excerpt,content,link,featured_media,author,type,_links,_embedded&per_page=${postsPerPage}&page=${page}`;
    }
    console.log('Example API URL for initial fetch:', buildInitialFetchApiUrl(1));
    /*
     * Update counts of each category in the categorySelect dropdown including the All Categories option
    */
    function updateCategoryCounts(posts) {
        // Reset all counts to 0
        categoryCountSpans.forEach(span => span.textContent = '0');
        // Count posts per category
        const categoryCounts = {};
        posts.forEach(post => {
            if ( post.categories ){
                for(const id of post.categories){
                    if (!categoryCounts[id]) {
                        categoryCounts[id] = 0; // Initialize count for this category
                    }
                    categoryCounts[id]++;                
                }
            }
            if (!categoryCounts['all']) {
                categoryCounts['all'] = 0; // Initialize 'all' count if not present
            }
            categoryCounts['all']++;
        });
        // Update the spans with the counts
        if ( categorySelect ){
            for(let option of categorySelect.options) {
                let id = option.value;
                let count = categoryCounts[id];
                if ( id === '' ){
                    count = categoryCounts['all'];
                }
                let span = option.querySelector('.act-posts-category-count');
                if ( span ) {
                    span.textContent = count || '0';
                }
            }
        }
    }
    /*
     *
    */
   function filterCategory(posts, filter) {
        let filteredPosts = posts;

        // Filter by categories
        if (filter.categories.length > 0) {
            filteredPosts = filteredPosts.filter(post => {
                return post.categories.some(category => filter.categories.includes(category));
            });
        }
        return filteredPosts;
    }
    function filterSearch(filteredPosts, filter) {
        // Filter by search query
        // If search query is enclosed in " " or ' ' search for the exact string in the post excerpt, content or title
        // otherwise split filter.search into words and match if any word matches
        if (filter.search && filter.search.trim() !== '') {
            console.log('Search query:', filter.search);
            let exactSearch = '';
            if ( filter.search.startsWith('"') && filter.search.endsWith('"') ) {
                exactSearch = filter.search.slice(1, -1).toLowerCase();
            } else if ( filter.search.startsWith("'") && filter.search.endsWith("'") ) {
                exactSearch = filter.search.slice(1, -1).toLowerCase();
            }
            if ( exactSearch.length > 0 ){
                console.log('Exact search:', exactSearch);
                filteredPosts = filteredPosts.filter(post => {
                    return post.title.rendered.toLowerCase().indexOf(exactSearch)>= 0 ||
                           post.excerpt.rendered.toLowerCase().indexOf(exactSearch)>= 0 ||
                           post.content.rendered.toLowerCase().indexOf(exactSearch)>= 0;
                });
            } else {
                const searchWords = filter.search.trim().split(/\s+/);
                for(let i = 0; i < searchWords.length; i++) {
                    searchWords[i] = searchWords[i].toLowerCase();
                }
                console.log('Search words:', searchWords);
                filteredPosts = filteredPosts.filter(post => {
                    return searchWords.some(word => {
                        return post.title.rendered.toLowerCase().includes(word) ||
                               post.excerpt.rendered.toLowerCase().includes(word) ||
                               post.content.rendered.toLowerCase().includes(word);
                    });
                });
            }
        }
        return filteredPosts;
    }
    function sortposts(posts, filter) {
        // Sort posts based on the selected criteria
        if (filter.sortBy && filter.sortOrder) {
            posts.sort((a, b) => {
                let aValue, bValue;
                switch (filter.sortBy) {
                    case 'date':
                        aValue = new Date(a.date).toISOString();
                        bValue = new Date(b.date).toISOString();
                        break;
                    case 'author':
                        aValue = getAuthorName(a, true);
                        bValue = getAuthorName(b, true);
                        break;
                    case 'title':
                        aValue = a.title?.rendered || '';
                        bValue = b.title?.rendered || '';
                        break;
                    default:
                        aValue = a[filter.sortBy];
                        bValue = b[filter.sortBy];
                }
                return filter.sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (bValue > aValue ? 1 : -1);
            });
        }
        return posts;
    }
    /*
     * Filter posts based on selected categories and search input
    */
    function filterPosts(posts, filter) {
        let filteredPosts = filterCategory(posts, filter);

        // Filter by search query
        filteredPosts = filterSearch(filteredPosts, filter);
        // Sort posts
        filteredPosts = sortposts(filteredPosts, filter);
        return filteredPosts;
    }
    /*
     * Display posts that satisfy filter, sorted according to filter
    */
    function displayPosts(posts, filter) {
        // Clear the post grid container
        postGridContainer.innerHTML = '';
        // Filter and sort posts
        const filteredPosts = filterPosts(posts, filter);
        console.log('Filtered posts count:', filteredPosts.length);
        // If no posts match the filter, show a message
        if (filteredPosts.length === 0) {
            noResultsMessage.style.display = 'block';
//           postGridContainer.style.display = 'none';
            return;
        } else {
            noResultsMessage.style.display = 'none';
//            postGridContainer.style.display = 'block'; // Show the grid container
        }
        // Create and append post panels to the grid container
        filteredPosts.forEach(post => {
            const postPanel = createPostPanel(post);
            postGridContainer.appendChild(postPanel);
        });
    }
    /*
     * Fetch all posts filling allposts array first page should be rendered as soon as possible
     * but rendering first page shouldn't impede fetching the rest of the posts.
    */
    async function fetchAllPosts() {
        let page = 1;
        let totalPages = 1; // Initialize total pages
        do {
            const apiUrl = buildInitialFetchApiUrl(page);
            console.log('Fetching posts from:', apiUrl);
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                // Get total page count from response headers
                totalPages = response.headers.get('X-WP-TotalPages');
                console.log('totalPages:', totalPages);
                const posts = await response.json();
                if (posts.length === 0) {
                    break; // No more posts to fetch
                }
                console.log('Fetched posts:', posts.length);
                allposts = allposts.concat(posts);
                console.log(`Fetched page ${page} of posts, total count: ${allposts.length}`);
                //updateCategoryCounts(allposts);
                page++;
            } catch (error) {
                console.error('Error fetching posts:', error);
                noResultsMessage.textContent = 'Error fetching posts. Please try again later.';
                break;
            }
        } while(page <= totalPages);
        displayPosts(allposts, filter);
    }
    async function buildIndex() {
        let page = 1;
        let totalPages = 1; // Initialize total pages
        postindex = [];
        do {
            const apiUrl = `${restUrl}?_fields=id,date,author,categories&per_page=${postsPerPage}&page=${page}`;
            console.log('Building index from:', apiUrl);
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                // Get total page count from response headers
                totalPages = response.headers.get('X-WP-TotalPages');
                console.log('totalPages:', totalPages);
                const posts = await response.json();
                if (posts.length === 0) {
                    break; // No more posts to fetch
                }
                console.log('Fetched posts:', posts.length);
                postindex = postindex.concat(posts);
                updateCategoryCounts(postindex);
                page++;
            } catch (error) {
                console.log(error.toString());
                noResultsMessage.textContent = 'Error building index. Please try again later.';
                break;
            }
        } while(page <= totalPages);
        console.log('Index built successfully');
        return postindex;
    }
    let fetchbusy = 0;
    let continue_fetch = 1;
    async function fetch_delay(millis){
        return new Promise((resolve, reject) => {
            setTimeout(resolve, millis);
        });
    }
    async function stopfetch(){
        continue_fetch = 0;
        return new Promise( async(resolve, reject) => {
            while(fetchbusy){
                console.log('Waiting for 1/10 sec');
                await fetch_delay(100);
                console.log('Back from wait');
            }
            resolve();
        });
    }
    async function fetchFilteredPosts(index, filter) {
        console.log('fetchFilteredPosts');
        continue_fetch = 1;
        fetchbusy = 1;
        let apiUrl = '';
        allposts = [];
        initialisedisplay();
        subindex = filterCategory(index, filter);
        subindex = sortposts(subindex, filter);
        //console.log('subindex length: ' + subindex.length);
        if ( subindex.length < 30 && filter.sortBy === 'author'){
            let authors = [];
            for(let sub of subindex){
                let author = getAuthorName(sub, true);
                authors.push(author);
            }
            console.log('sub authors: ', authors);
        }
        // form the API URL to fetch posts by IDs in blocks of 20
        if ( subindex.length === 0 ) {
            console.log('No posts found for selected categories');
        } else {
            for(let s = 0, page = 1; s < subindex.length && continue_fetch; s += 20, page++){
                let subids = [];
                for( let i = 0; i < 20; i++){
                    if ( s + i < subindex.length){
                        subids.push( subindex[s + i].id);
                    }
                }
                apiUrl = `${restUrl}?include=${subids.join(',')}&_embed=wp:featuredmedia,author&_fields=title,categories,date,excerpt,content,link,featured_media,author,type,_links,_embedded&per_page=20`;
                 //&order=${filter.sortOrder}&orderby=${filter.sortBy}`;
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                // Get total page count from response headers
                totalPages = response.headers.get('X-WP-TotalPages');
                console.log('totalPages:', totalPages);
                let posts = await response.json();
                if (posts.length === 0) {
                    break; // No more posts to fetch
                }
                posts = filterSearch(posts, filter);
                posts = sortposts(posts, filter);
                console.log('Fetched posts:', posts.length);
                allposts = allposts.concat(posts);
                console.log(`Fetched page ${page} of posts, total count: ${allposts.length}`);
                if ( selectedCount ){
                    selectedCount.textContent = allposts.length;
                }
                //updateCategoryCounts(allposts);
                if ( continue_fetch){
                    notifymoreposts();
                }
            }
        }
        fetchbusy = 0;
    }
    await buildIndex();
    fetchFilteredPosts(postindex, filter);
//    fetchAllPosts();
    function initialisedisplay(){
        // Clear the post grid container
        postGridContainer.innerHTML = '';
        lastpost = 0;
    }
    function notifymoreposts(){
        if ( !displaybusy ){
            displaybusy = true;
            while ( lastpost < allposts.length){
                let post = allposts[lastpost];
                const postPanel = createPostPanel(post);
                postGridContainer.appendChild(postPanel);
                lastpost++;
            }
            displaybusy = false;
        }
    }
    /*((((
     * change event handlers
    */
    function enableControls(enable){
        if ( categorySelect ){
            categorySelect.disabled = enable ? false : true;
        }
        if ( searchInput ){
            searchInput.disabled = enable ? false : true;
        }
        if ( sortSelect ){
            sortSelect.disabled =  enable ? false : true;
        }
    }   
    if ( categorySelect ){ 
        categorySelect.addEventListener('change', async function() {
            await stopfetch();
            filter = getFilterObject();
            console.log('Category selection changed, filter:', filter);

            await fetchFilteredPosts(postindex, filter);
        });
    }
    if ( searchInput ){
        searchInput.addEventListener('input', async function() {
            await stopfetch();
            filter = getFilterObject();
            console.log('Search input changed, filter:', filter);
            await fetchFilteredPosts(postindex, filter);
        });
    }
    if ( sortSelect ){
        sortSelect.addEventListener('change', async function() {
            await stopfetch();
            filter = getFilterObject();
            console.log('Sort selection changed, filter:', filter);
            await fetchFilteredPosts(postindex, filter);
        });
    }
    // TODO sort index after filtering.
});
