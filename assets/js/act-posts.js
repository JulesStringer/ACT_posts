// Ensure the DOM is fully loaded before running script
document.addEventListener('DOMContentLoaded', async function() {
    // Get localized data from PHP
    const restUrl = actPostsData.rest_url;
    const initialCategoryIdsFromPHP = actPostsData.initial_category_ids; // Array of IDs
    const initialSortByFromPHP = actPostsData.initial_sort_by;
    const initialSortOrderFromPHP = actPostsData.initial_sort_order;
    const excerptLength = actPostsData.excerpt_length;
    const siteRestUrl = actPostsData.site_rest_url; // Base REST URL for other endpoints like categories
    const posttype = actPostsData.post_type;
    const initial_window_start = actPostsData.initial_window_start;
console.log('initial_window_start: ' , initial_window_start);
console.log('restUrl:', restUrl);
console.log('posttype: ', posttype);
    // DOM Elements
    const postGridContainer = document.getElementById('act-posts-grid-container');
    const categorySelect = document.getElementById('act-posts-category-select');
    console.log('categorySelect:', categorySelect);
    const categoryCountSpans = document.querySelectorAll('.act-posts-category-count');
    const searchInput = document.getElementById('act-posts-search-input');
    const sortSelect = document.getElementById('act-posts-sort-select');
    const noResultsMessage = document.getElementById('act-posts-no-results');
    const selectedCount = document.getElementById('act-posts-selected');
    const eventWindowStart = document.getElementById('event-window-start');

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
            if ( posttype === 'event' ){
                return { by: 'from', order: 'asc' };
            }
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
    function postpanelhtml(postLink, featuredImageHtml, postTitle, postDate, authorName, summaryContent){
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
        return panelHtmlString;
    }
    function teampanelhtml(postLink, featuredImageHtml, postTitle, summaryContent){
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
        return panelHtmlString;
    }
    function formatHHMM(d){
        let h = d.getHours();
        let m = d.getMinutes();
        let timeline = '';
        timeline += h + ':';
        if ( m < 10 ) timeline += '0';
        timeline += m;
        return timeline;
    }
    function formatDate(d){
        let now = new Date();
        let options = { weekday: 'long', month: 'long', day: 'numeric' };
        if ( now.getFullYear() != d.getFullYear()){
            options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        }
        return d.toLocaleString('EN-GB', options);
    }
    function formDate(str){
        let dstr = str.replace(' ','T');
        return new Date(dstr);
    }
    function eventpanelhtml(postLink, featuredImageHtml, postTitle, summaryContent, acf){
        timeline = '';
        let from = formDate(acf.from);
        let to = formDate(acf.to);
        timeline += formatHHMM(from) + ' to ' + formatHHMM(to);
        timeline += ' ' + formatDate(from);
        if ( acf.interval_type != 'none'){
            timeline += ' and every ' + acf.interval_value + ' ' + acf.interval_type;
            if ( acf.interval_value > 1 ){
                timeline += 's';
            }
            if ( acf.interval_enddate ){
                let d = formDate(acf.interval_enddate);
                timeline += ' until ' + formatDate(d);
            }
        }
        let location = acf.location;
        if ( acf.postcode ){
            location += ' ' + acf.postcode;
        }
        panelHtmlString = `
            <div class="post-panel">
                <a href="${postLink}">
                    <div class="panel-content">
                        <p>${timeline}</p>
                        <div class="post-text-content">
                            <h3 class="post-title">${postTitle}</h3>
                            <p>${location}</p>
                            <div class="post-summary">
                                <p>${summaryContent}</p>
                            </div>
                        </div>
                    </div>
                </a>
            </div>
        `;
        return panelHtmlString;
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
                    <img src="${imageUrl}" alt="${imageAlt}" class="post-featured-image" loading="lazy">
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
        if ( posttype === 'posts'){
            panelHtmlString = postpanelhtml(postLink, featuredImageHtml, postTitle, postDate, authorName, summaryContent)
        } else if ( posttype === 'team') {
            panelHtmlString = teampanelhtml(postLink, featuredImageHtml, postTitle, summaryContent);
        } else if ( posttype === 'event') {
            //console.log('posttype: ' + posttype);
            panelHtmlString = eventpanelhtml(postLink, featuredImageHtml, postTitle, summaryContent, post.acf);
            //console.log('panelHtmlString: ' + panelHtmlString);
        } else {
//            panelHtmlString = '<div class="post-panel"><p>Post type: "' + posttype + '" not recognised by ACT_posts plugin</p></div>';
            panelHtmlString = postpanelhtml(postLink, featuredImageHtml, postTitle, postDate, authorName, summaryContent)
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
    function buildFetchApiUrl(page, posttype, ids){
        // We fetch *all* posts potentially, so( no category/search filter here
        // The REST API default max is 100, if more posts exist, you might need a loop or
        // a custom endpoint. For <200 posts, 100 will get a good chunk.
        // For truly ALL posts, you'd need to loop based on X-WP-TotalPages
        let r = restUrl + '?';
        if ( ids ){
            r += 'include=' + ids.join(',') + '&';
        }
        if ( posttype === 'posts' ){
            r += '_embed=wp:featuredmedia,author&_fields=title,categories,date,excerpt,content,link,featured_media,author,_links,_embedded';
        } else if ( posttype === 'team' ){
            r += '_embed=wp:featuredmedia&_fields=title,date,excerpt,content,link,featured_media,_links,_embedded';
        } else if ( posttype === 'event'){
            r += '_embed=wp:featuredmedia,author&_fields=id,title,date,excerpt,content,link,featured_media,acf,_links,_embedded';
        } else {
//            console.log('buildFetchApiUrl incorrect posttype: ', posttype);
            r += '_embed=wp:featuredmedia,author&_fields=title,categories,date,excerpt,content,link,featured_media,author,_links,_embedded';
        }
        r += '&per_page=20';
        if ( !ids ){
            r += '&page=' + page;
        }
        return r;
    }
    console.log('Example API URL for initial fetch:', buildFetchApiUrl(1, posttype, null));
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
        // Update the counts directly in the option's text content
        if ( categorySelect ){
            for(let option of categorySelect.options) {
                let id = option.value;
                let count = categoryCounts[id];
                if ( id === '' ){
                    count = categoryCounts['all'];
                }

                // Get the original name part (e.g., "Act with art")
                // This assumes the name is always before the first '('
                let originalName = option.textContent.split('(')[0].trim();

                // Update the option's text content
                option.textContent = originalName + `(${count || '0'})`;
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
                    case 'from':
                        //console.log('a: ', a, ' b: ', b);
                        if ( a.from ){
                            aValue = a.from;
                        } else if ( a.acf ){
                            aValue = formDate(a.acf.from);
                        }
                        if ( b.from ){
                            bValue = b.from;
                        } else if ( b.acf ) {
                            bValue = formDate(b.acf.from);
                        }
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
     *  build index for normal posts and any post type except events
    */
    async function buildIndex() {
        let page = 1;
        let totalPages = 1; // Initialize total pages
        postindex = [];
        do {
            const apiUrl = `${restUrl}?_fields=id,date,author,categories&per_page=100&page=${page}`;
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
    // TODO need to build index differently for events.
    // Index should probably be read in php
    // Index , other functions read at start need to be read when news/events/etc is selected rather always.
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
    function seteventdates(posts, sub_index_entries){
        for(i = 0; i < posts.length; i++){
            if ( posts[i].acf.interval_type && posts[i].acf.interval_type !== 'none'){
                let item = sub_index_entries[posts[i].id];
                console.log(i, 'recurring event: ', posts[i].id, ' item: ', item);
                if ( item ){
                    posts[i].acf.from = item.from.toISOString();
                    posts[i].acf.to = item.to.toISOString();
                }
            }
        }
        return posts;
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
            console.log('subindex length: ' + subindex.length);
            for(let s = 0, page = 1; s < subindex.length && continue_fetch; s += 20, page++){
                let subids = [];
                let sub_index_entries = {};
                for( let i = 0; i < 20; i++){
                    if ( s + i < subindex.length){
                        subids.push( subindex[s + i].id);
                        sub_index_entries[subindex[s + i].id] = subindex[s + i];
                    }
                }
                //apiUrl = `${restUrl}?include=${subids.join(',')}&_embed=wp:featuredmedia,author&_fields=title,categories,date,excerpt,content,link,featured_media,author,type,_links,_embedded&per_page=20`;
                apiUrl = buildFetchApiUrl(page, posttype, subids);
                console.log('posttype: ', posttype);
                console.log('apiUrl: ', apiUrl);

                 //&order=${filter.sortOrder}&orderby=${filter.sortBy}`;
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                // Get total page count from response headers
                //totalPages = response.headers.get('X-WP-TotalPages');
                //console.log('totalPages:', totalPages);
                let posts = await response.json();
                if (posts.length === 0) {
                    break; // No more posts to fetch
                }
                console.log('Candidate posts: ' + posts.length);
                if ( posttype === 'event'){
                    console.log('about to call seteventdates sub_index_entries: ', sub_index_entries);
                    posts = seteventdates(posts, sub_index_entries);
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
    /*
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
    if ( eventWindowStart ){
        eventWindowStart.addEventListener('change', async function(){
            let v = eventWindowStart.value;
            await stopfetch();
            let d = new Date(v);
            await buildEventIndex(d.toISOString());
            await fetchFilteredPosts(postindex, filter);
        });
    }

    function addMonths(dt, mon){
        let y = dt.getFullYear();
        let m = dt.getMonth();
        let d = dt.getDate();
        let h = dt.getHours();
        let min = dt.getMinutes();
        m += mon;
        while ( m > 11){
            m -= 12;
            y++;
        }
        return new Date(y,m,d,h,min,0);
    }
    async function buildEventIndex(window_start_str){
        let window_start = new Date(window_start_str);
        console.log('window_start: ', window_start.toISOString());
        // get the events
        let page = 1;
        let totalPages = 1; // Initialize total pages
        postindex = [];
        do {
            const apiUrl = `${restUrl}?_fields=id,acf&per_page=100&page=${page}`;
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
                // filter posts
                for(const post of posts){
                    let from = formDate(post.acf.from);
                    let to = formDate(post.acf.to);
                    let classification = post.acf.classification;
                    let id = post.id;
                    if ( post.acf ){
                        if ( post.acf.interval_type && post.acf.interval_type != 'none'){
                            // event is repeated
                            let interval_end = null;
                            if ( post.acf.interval_end ){
                                interval_end = new Date(post.acf.interval);
                            }
                            if ( (interval_end && interval_end > from) || interval_end === null){
                                // wind from and to dates forward until
                                item = {
                                    from: from,
                                    to: to,
                                    id: id,
                                    classification: classification
                                }
                                console.log(item);
                                let t = post.acf.interval_type;
                                let v = post.acf.interval_value;
                                if ( v ){
                                    while(from < window_start){
                                        let mult = v;
                                        if ( t === 'month'){
                                            from = addMonths(from, mult);
                                            to = addMonths(to, mult);
                                        } else {
                                            if ( t === 'week'){
                                                mult *= 7;
                                            }
                                            from = new Date(from.getTime() + mult * 24 * 3600 * 1000);
                                            to = new Date(to.getTime() + mult * 24 * 3600 * 1000);
                                        }
                                    }
                                }
                                item.from = from;
                                item.to = to;
                                postindex.push(item);
                            }
                        } else {
                            // event is single
                            let to = new Date(post.acf.to);
                            if ( to > window_start ) {
                                item = {
                                    from: from,
                                    to: to,
                                    id: id,
                                    classification: classification
                                }
                                postindex.push(item);
                            }
                        }
                    }
                }
                console.log('Fetched posts:', posts.length);
                //postindex = postindex.concat(posts);
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
    if (typeof actPostsData !== 'undefined' && actPostsData.post_type != '') {
        if ( posttype !== 'event' ){
            await buildIndex();
        } else if ( posttype === 'event'){
            await buildEventIndex(initial_window_start); // different sort of index
        }
        fetchFilteredPosts(postindex, filter);
    }
});
