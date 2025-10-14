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
    const select_list = actPostsData.select_list;
    const nonce = actPostsData.nonce;
    const initial_values = actPostsData.initial_values;
    console.log('actPostsData:', actPostsData);
console.log('nonce: ', nonce);
console.log('select_list length: ', select_list.length);
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
    const custom_filter_controls = document.querySelectorAll('.custom-filter-select');

    const morepostsDiv = document.getElementById('act-posts-more');
    const loadMoreButton = document.getElementById('act-posts-load-more-button');
    const BLOCK_LENGTH = 10; // Number of posts to display per block
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
     * Initialise selector values for custom post types
    */
    function initCustomSelects(initial_values){
        if ( custom_filter_controls && initial_values ){
            //console.log('Initialising custom filter controls initial_values: ', initial_values );
            for(let select of custom_filter_controls){
                let fieldname = select.getAttribute('id');
                //console.log('select: ', select, ' fieldname: ', fieldname);
                if ( initial_values[fieldname] ){
                    let values = initial_values[fieldname];
                    //console.log ('initialising field:' + fieldname + ' with values: ', values);;
                    if ( !Array.isArray(values)){
                        values = [values];
                    }
                    for(let option of select.options){
                        //console.log('considering option: ', option.value);
                        if ( values.includes(option.value)) {
                            option.selected = true;
                            //console.log('Selecting option:', option.value);
                        } else if (option.value === '') {
                            option.selected = false; // Ensure 'All' option is not selected
                        }
                    }
                }
            }
        }
    }
    if ( custom_filter_controls ){
        initCustomSelects(initial_values);
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
    /**
     * Reads the values from the custom select controls and returns an object
     * containing only the filters that have a selected value (not 'All').
     *
     * @returns {object} An associative array of filters: { field_name: selected_value, ... }
     */
    function getActiveSelectFilters() {
        const filterArray = {};
        
        // 1. Target the table container for efficiency
        const table = document.querySelector('.act-custom-controls');

        if (!table) {
            console.error("Filter table not found.");
            return filterArray;
        }

        // 2. Select all <select> elements within the table
        const selectElements = table.querySelectorAll('select');

        // 3. Iterate over the elements to build the filter array
        for(const selectElement of selectElements) {
            // The field name is used as the select element's ID
            const fieldName = selectElement.id;
            let selectedValue;

            if (selectElement.multiple) {
                // --- Multi-select logic ---
                // Use selectedOptions property to get all selected options
                // Convert the HTMLCollection to an Array and map to get the values
                const selectedValues = Array.from(selectElement.selectedOptions)
                                            .map(option => option.value);
                // Filter out any default empty values (like the 'All' option, if selected in a multi-select)
                selectedValue = selectedValues.filter(value => value !== '');

                // If the user hasn't selected anything or only selected the empty option, 
                // the filtered array will be empty.
                if (selectedValue.length > 0 ) {
                   filterArray[fieldName] = selectedValue;
console.log('Multi-select field:', fieldName, 'selected values:', selectedValue);
                }
                
            } else {
                // --- Single-select logic (original) ---
                selectedValue = selectElement.value;
console.log('Single select field:', fieldName, 'selected value:', selectedValue);
                if (selectedValue !== '') {
                    filterArray[fieldName] = selectedValue;
                }
            }
        }

        return filterArray;
    }
    /*
     * Get filter object from selected categories and search input
    */
    function getFilterObject() {
        if ( posttype === 'posts' || posttype === 'events' || posttype === 'team'){
            const selectedCategories = getSelectedCategories();
            const searchQuery = ( searchInput ? searchInput.value.trim() : '');
            const sort = getSelectedSort();

            return {
                categories: selectedCategories,
                search: searchQuery,
                sortBy: sort.by,
                sortOrder: sort.order
            };
        } else {
            return getActiveSelectFilters();
        }
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
    function custompanelhtml(postLink, featuredImageHtml, postTitle, summaryContent, acf){
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
            panelHtmlString = custompanelhtml(postLink, featuredImageHtml, postTitle, summaryContent, post.acf)
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
    // --- Function to build API URL for initial fetch ---hi
    function buildFetchApiUrl(page, posttype, ids){
        // We fetch *all* posts potentially, so( no category/search filter here
        // This is now called to fetch BLOCK_LENGTH posts aka pages in the REST API.
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
            r += '_embed=wp:featuredmedia,author&_fields=title,excerpt,content,link,featured_media,author,_links,_embedded';
        }
        r += '&per_page= '+ BLOCK_LENGTH;
        if ( !ids ){
            r += '&page=' + page;
        }
        return r;
    }
    /*
     *
    */
   function filterCategory(posts, filter) {
console.log('Initial posts: ' + posts.length);
        let filteredPosts = posts;
console.log('Filter: ' , filter);
        // Filter by categories
        if (filter.categories) {
            if ( filter.categories.length > 0) {
                filteredPosts = filteredPosts.filter(post => {
                    return post.categories.some(category => filter.categories.includes(category));
                });
            }
        } else {
            for(let name in filter){
                if ( name != 'categories' && name != 'search' && name != 'sortBy' && name != 'sortOrder'){
                    console.log(filteredPosts);
                    if ( Array.isArray(filter[name])){
                        filteredPosts = filteredPosts.filter(post => {
                            //console.log('post: ' + JSON.stringify(post));
                            return post[name].length > 0 && post[name].some(target => filter[name].includes(target));
                        });
                    } else {
                        filteredPosts = filteredPosts.filter(post => {
                            return post[name] === filter[name];
                        });
                    }
                    console.log(name + ' reduced posts to ' + filteredPosts.length);
                }
            }
        }
console.log('Filtered posts: ' + filteredPosts.length);
        return filteredPosts;
    }
    async function filterSearch(posts, filter){
        let filteredPosts = posts;
        if ( filter.search && filter.search.trim() !== '' ){
            console.log('Search query:', filter.search);
            // Now call AJAX backend search
            filteredPosts = await fetch('/wp-admin/admin-ajax.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: new URLSearchParams({
                    action: 'act_posts_search',
                    search: filter.search,
                    nonce: nonce,
                    post_type: posttype
                })
            })
            .then(async res => {
                //console.log('AJAX search response status:', res.status);
                if (!res.ok) {
                    throw new Error(`HTTP error! Status: ${res.status}`);
                }
                let result = await res.json();
                //console.log('AJAX search result:', typeof(result), result);
                return result.data;
            }).catch(err => {
                console.error('AJAX search error:', err);
                return null;
            });
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
        // Index now formed on server in a single optimised SQL
        postindex = select_list;
        console.log('Index length: ', postindex.length);
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
                console.log('Back from wait continue_fetch ' + continue_fetch + ' fetchbusy ' + fetchbusy);
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
    function show_custom_counts(){
        // Note the span elements in options are not supported by firefox
        // and are not strictly html compliant, so the whole option text
        // needs to be built to include the count.
        let docount = false;
        // form first_select_list;
        let first_filter_control = custom_filter_controls[0];
        let fieldname = first_filter_control.getAttribute('id');
        console.log('select_list.length ' + select_list.length);
        console.log('first_filter_control: ', first_filter_control);
        console.log('first_filter_control.value: ', first_filter_control.value);
        let sub_select_list = [];
        if ( first_filter_control.value === ''){
            sub_select_list = select_list;
        } else {
            for(let item of select_list){
                console.log('item[' + fieldname + ' ]: ' + item[fieldname]);
                if ( item[fieldname] === first_filter_control.value ){
                    sub_select_list.push(item);
                }
            }
        }
        let allcount = sub_select_list.length;
        console.log('allcount= ' + allcount);
        for(let custom_filter_control of custom_filter_controls){
            let options = custom_filter_control.querySelectorAll('option');
            let fieldname = custom_filter_control.getAttribute('id');
            if ( docount ){
                for(let option of options){
                    let id = option.getAttribute('data-id');
                    let label = option.getAttribute('data-label');
                    if ( id === 'all' ){
                        option.textContent = label + '(' + allcount + ')';
                    } else {
                        let c = 0;
                        for( let post of sub_select_list){
                            if ( post[fieldname] ){
                                if ( Array.isArray(post[fieldname]) ){
                                    if ( post[fieldname].includes(id) ){
                                        c++;
                                    }
                                } else {
                                    if ( post[fieldname] === id ){
                                        c++;
                                    }
                                }
                            }
                        }
                        option.textContent = label + '(' + c + ')';
                    }
                }
            }
            docount = true;
        }
    }
    let start_page = 0;
    let page = 1;
    async function fetchFilteredPosts(index, filter) {
        //console.log('fetchFilteredPosts index length: ' + index.length + ' typeof(index) ', typeof(index));
        continue_fetch = 1;
        fetchbusy = 1;
        allposts = [];
        
        initialisedisplay();
        // ensure that the more posts button is hidden while fetching
        // which stops the first page being displayed twice when the first filter is applied.
        morepostsDiv.style.display = 'none';       
        subindex = filterCategory(index, filter);
        //console.log('Category filtered index length: ' + subindex.length + ' typeof(subindex): ' + typeof(subindex));
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
        if ( posttype !== 'event' && posttype !== 'posts' && posttype !== 'team' ){
            show_custom_counts(subindex);
        }
        fetchbusy = 0;
        sessionStorage.setItem('SELECT_LIST', JSON.stringify(subindex));
        start_page = 0;
        page = 1;
        if ( subindex.length === 0 ) {
            console.log('No posts found for selected categories');
        } else {
            fetch_next_block_posts();
        }
        fetchbusy = 0;
    }
    async function fetch_next_block_posts(){
        let apiUrl = '';
//console.log('fetch_next_block_posts start_page: ' + start_page + ' page: ' + page);
//console.log('subindex length: ' + subindex.length);
        let subids = [];
        let sub_index_entries = {};
        for( let i = 0; i < BLOCK_LENGTH; i++){
            if ( start_page + i < subindex.length){
                subids.push( subindex[start_page + i].id);
                sub_index_entries[subindex[start_page + i].id] = subindex[start_page + i];
            }
        }
        // form the API URL to fetch posts by IDs in blocks of BLOCK_LENGTH
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
            return; // No more posts to fetch
        }
        console.log('Candidate posts: ' + posts.length);
        if ( posttype === 'event'){
            console.log('about to call seteventdates sub_index_entries: ', sub_index_entries);
            posts = seteventdates(posts, sub_index_entries);
        }
        posts = sortposts(posts, filter);
        console.log('Fetched posts:', posts.length);
        allposts = allposts.concat(posts);
        console.log(`Fetched page ${page} of posts, total count: ${allposts.length}`);
        if ( selectedCount ){
            selectedCount.textContent = allposts.length;
        }
        if ( continue_fetch){
            notifymoreposts();
        }
        start_page+=BLOCK_LENGTH;
        page++;
        if ( start_page < subindex.length ){
            morepostsDiv.style.display = 'block';
        } else {
            morepostsDiv.style.display = 'none';
        }
    }
    // Intersection Observer to auto-fetch next page when "Load More" button appears in view
    if ('IntersectionObserver' in window && loadMoreButton) {
        const observer = new IntersectionObserver(async (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting && continue_fetch && start_page < subindex.length) {
                    morepostsDiv.style.display = 'none';
//console.log('Load More button in view, fetching next block of posts...');
                    await fetch_next_block_posts();
                }
            }
        }, {
            root: null, // viewport
            threshold: 0.1 // trigger when at least 10% visible
        });
        observer.observe(loadMoreButton);
    }

    loadMoreButton.addEventListener('click', async function(){
        if ( continue_fetch ){
            morepostsDiv.style.display = 'none';
            if ( start_page < subindex.length ) {
//console.log('Load More button clicked, fetching next block of posts...');
                await fetch_next_block_posts();
            }
        }
    });
    // TODO something to trigger fetching the next block
    function initialisedisplay(){
        // Clear the post grid container
        postGridContainer.innerHTML = '';
        console.log('Display initialised');
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
            console.log('Search selection changed');
            await stopfetch();
            filter = getFilterObject();
            console.log('Category selection changed, filter:', filter);

            await fetchFilteredPosts(postindex, filter);
        });
    }
    if ( custom_filter_controls ){
        for(let custom_filter_control of custom_filter_controls){
            custom_filter_control.addEventListener('change', async function(){
                await stopfetch();
                filter = getFilterObject();
                console.log('Selection filter changed');

                await fetchFilteredPosts(postindex, filter);
            })
        }
    }
    if ( searchInput ){
        searchInput.addEventListener('input', async function() {
            await stopfetch();
            filter = getFilterObject();
            console.log('Search input changed, filter:', filter);
            postindex = await filterSearch(select_list, filter);
            if ( postindex ){
                console.log('Search filtered index length: ', postindex.length, ' typeof: ', typeof(postindex));
                await fetchFilteredPosts(postindex, filter);
            }
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
