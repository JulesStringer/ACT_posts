(function($) {
    $(document).ready(async function() {
        
        // Ensure localized data exists
        if (typeof ACT_NAV_DATA === 'undefined' || !ACT_NAV_DATA.current_post_id) {
            return; // Exit if data is missing
        }
        const ajaxurl = ACT_NAV_DATA.ajax_url; 
        const nonce = ACT_NAV_DATA.nonce;
        var currentPostId = parseInt(ACT_NAV_DATA.current_post_id);
        console.log('CurrentPostId: ' + currentPostId);
        var selectionListString = sessionStorage.getItem('SELECT_LIST');
        
        if (!selectionListString) {
            return; // Exit if no filtered list is found in this tab's session
        }

        var selectionObjects = JSON.parse(selectionListString);
        console.log('Got SELECT_LIST: ', selectionObjects);
        var selectionListIds = selectionObjects.map(function(item) {
            return parseInt(item.id); 
        });
        var currentIndex = selectionListIds.indexOf(currentPostId);
        if (currentIndex === -1) {
            return; // Exit if the current post is not in the list
        }

        let prevId = 0;
        let nextId = 0;
        console.log('Position in list: ' + currentIndex);
        console.log('Nonce was ' + nonce);
        if ( currentIndex > 0){
             prevId = selectionListIds[currentIndex - 1];
             prevHtml = await fetchAndRenderLink(prevId,'act-prev', nonce);
        }
        if ( currentIndex + 1 < selectionListIds.length ){
             nextId = selectionListIds[currentIndex + 1];
             nextHtml = await fetchAndRenderLink(nextId,'act-next', nonce);
        }
        console.log('PrevId: ' + prevId + ' nextID: ' + nextId);
        // Process all navigation placeholders on the page
        $('.act-nav-placeholder').each(async function() {
            var $placeholder = $(this);
            var direction = $placeholder.data('direction'); // Reads -1 or 1
            var linkId = (direction === -1) ? prevId : nextId;
            //var linkText = (direction === -1) ? '&laquo; Previous' : 'Next &raquo;';
            //var linkClass = (direction === -1) ? 'act-prev' : 'act-next';
            
            if (linkId) {
                // Generate the link HTML
                var linkHtml = '';
                if ( direction === -1 ) {
                    linkHtml += '<span class="wp-block-post-navigation-link__arrow-previous is-arrow-arrow" aria-hidden="true">←</span>';
                    linkHtml += prevHtml;
                } else {
                    linkHtml += nextHtml;
                    linkHtml += '<span class="wp-block-post-navigation-link__arrow-next is-arrow-arrow" aria-hidden="true">→</span>';
                }
                $placeholder.html(linkHtml);
            }
        });
        async function fetchAndRenderLink(linkId, linkClass, nonce) {
            return new Promise((resolve,reject) => {
                $.ajax({
                    url: ajaxurl, // WordPress global for the AJAX endpoint
                    type: 'POST',
                    data: {
                        action: 'act_get_post_details', // The PHP action hook
                        post_id: linkId,
                        nonce: nonce
                    },
                    success: function(response) {
                        if (response.success && response.data.url) {
                            var url = response.data.url;
                            var title = response.data.title;
                            // ... logic to determine linkText and linkClass based on placeholder direction ...

                            var linkHtml = '<a href="' + url + '" class="' + linkClass + '">' + title + '</a>';
                            resolve(linkHtml);
                        } else if ( !response.success){
                            reject(new Error('response.success was false '));
                        } else if ( !response.data.url){
                            reject(new Error('response.data.url not returned'));
                        }
                    }
                });
            });
        }
    });
})(jQuery);